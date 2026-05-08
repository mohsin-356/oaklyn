import { useEffect, useMemo, useRef, useState } from 'react'
import { listSales, listReturns, getRestaurantInfo, getActiveBusinessDateId, getBusinessDateId, deleteSale, getPrinterConfig, getCurrentUser, createReprintRequest, getPendingReprintForToken, getApprovedReprintForToken, createNotification, listReprintRequests } from '../utils/storage.js'
import { useConfirm } from '../components/ConfirmProvider.jsx'

export default function SaleHistory(){
  const [sales, setSales] = useState([])
  const [returns, setReturns] = useState([])
  const [date, setDate] = useState('') // yyyy-mm-dd
  const dateRef = useRef(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10) // use -1 to indicate "All"
  const confirm = useConfirm()
  // Receipt modal state
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptHtml, setReceiptHtml] = useState('')
  const [reprintReason, setReprintReason] = useState('')
  const [reprintReasonToken, setReprintReasonToken] = useState(null)
  const [pendingReprints, setPendingReprints] = useState({})
  const [approvedReprints, setApprovedReprints] = useState({})
  const [activeTab, setActiveTab] = useState('sales') // 'sales' | 'requests'
  const [allReprintRequests, setAllReprintRequests] = useState([])
  const user = getCurrentUser()
  const isAdmin = user && String(user.role || '').toLowerCase() === 'admin'


  const load = async () => { try { setSales(await listSales()) } catch {}; try { setReturns(await listReturns()) } catch {} }

  useEffect(()=>{
    load()
    // Default to active business date
    setDate(getActiveBusinessDateId())
    const syncDate = () => { setDate(getActiveBusinessDateId()) }
    const onSales = () => load()
    const onReturns = () => load()
    window.addEventListener('data:sales-changed', onSales)
    window.addEventListener('data:returns-changed', onReturns)
    window.addEventListener('storage', load)
    window.addEventListener('day:status-changed', syncDate)
    window.addEventListener('notifications:changed', load)
    return () => {
      window.removeEventListener('data:sales-changed', onSales)
      window.removeEventListener('data:returns-changed', onReturns)
      window.removeEventListener('storage', load)
      window.removeEventListener('day:status-changed', syncDate)
      window.removeEventListener('notifications:changed', load)
    }
  },[])

  const recBizIdEq = (rec, ymd) => {
    if (!ymd) return true
    try { return (rec?.bizId || getBusinessDateId(rec?.createdAt||Date.now())) === ymd } catch { return false }
  }

  const filteredSales = useMemo(()=> sales.filter(r => recBizIdEq(r, date)), [sales, date])
  const totalPages = useMemo(()=> {
    if (pageSize === -1) return 1
    return Math.max(1, Math.ceil((filteredSales.length||0) / (pageSize||10)))
  }, [filteredSales.length, pageSize])
  useEffect(()=>{ setPage(1) }, [filteredSales])
  useEffect(()=>{ if (page > totalPages) setPage(totalPages) }, [page, totalPages])
  const pagedSales = useMemo(()=>{
    if (pageSize === -1) return filteredSales
    const start = (page-1) * pageSize
    return filteredSales.slice(start, start + pageSize)
  }, [filteredSales, page, pageSize])
  const filteredReturns = useMemo(()=> returns.filter(r => recBizIdEq(r, date)), [returns, date])

  const returnedIds = useMemo(() => new Set(returns.map(r => String(r.referenceSaleId || ''))), [returns])

  const totals = useMemo(()=>{
    const subtotal = filteredSales.reduce((sum, s) => sum + (Number(s.subtotal)||0), 0)
    const deliveryCharges = filteredSales.reduce((sum, s) => sum + (Number(s.deliveryCharges)||0), 0)
    const gross = subtotal + deliveryCharges
    const discount = filteredSales.reduce((sum, s) => sum + (Number((s.discount ?? s.discountAmount) || 0)||0), 0)
    const returned = filteredReturns.reduce((sum, r) => sum + (Number(r.total)||0), 0)
    const net = Math.max(0, gross - discount)
    const finalNet = Math.max(0, net - returned)
    return { subtotal, deliveryCharges, gross, discount, returned, net: finalNet, saleTotal: gross, returnTotal: returned }
  },[filteredSales, filteredReturns])

  // Delete a sale with confirmation
  const onDelete = async (id) => {
    if (!id) return
    const ok = await confirm({ title: 'Delete Sale', description: 'Are you sure you want to delete this sale record?', confirmText: 'Delete', cancelText: 'Cancel' })
    if (!ok) return
    try { await deleteSale(id) } catch {}
    await load()
  }

  // Check reprint status for visible sales
  useEffect(() => {
    const checkReprints = async () => {
      const pending = {}
      const approved = {}
      for (const s of pagedSales) {
        try {
          const p = await getPendingReprintForToken(s.token)
          if (p) pending[s.token] = p
          const a = await getApprovedReprintForToken(s.token)
          if (a) approved[s.token] = a
        } catch {}
      }
      setPendingReprints(pending)
      setApprovedReprints(approved)
    }
    if (!isAdmin && pagedSales.length > 0) checkReprints()
  }, [pagedSales, isAdmin])

  // Load reprint requests for Requests tab
  useEffect(() => {
    const loadReprintReqs = async () => {
      try {
        const reqs = await listReprintRequests()
        setAllReprintRequests(Array.isArray(reqs) ? reqs : [])
      } catch {}
    }
    if (activeTab === 'requests') loadReprintReqs()
  }, [activeTab])

  // Reprint receipt
  function reprint(rec, currentBizId){
    const bizId = currentBizId || (()=>{ try { return rec?.bizId || getActiveBusinessDateId() } catch { return '' } })()
    const rest = getRestaurantInfo()

    const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    const items = (rec.items||[]).map(i => ({ name: `${i.qty} x ${i.name}` , price: (i.price*i.qty).toFixed(2) }))
    const dt = new Date(rec.createdAt || Date.now()).toLocaleString('en-GB', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})
    const discount = Number(rec.discount || rec.discountAmount || 0)
    const itemsHtml = items.map(l => `<div class="row"><div>${esc(l.name)}</div><div>Rs.${l.price}</div></div>`).join('')
    const receiptHtml = `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <title>Receipt</title>
      <style>@page{size:auto;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;height:auto !important;min-height:100% !important;overflow:visible !important}body{font-family:ui-monospace,Menlo,Consolas,monospace;padding:8px 8px 50mm 8px;font-weight:700;overflow:visible !important}img,svg{max-width:100%;height:auto}.center{text-align:center;font-weight:700;page-break-inside:avoid}.small{font-size:14px;line-height:1.35}.row{display:flex;justify-content:space-between;gap:8px;page-break-inside:avoid}.sep{border-top:1px dashed #000;margin:8px 0}.logo{display:block;margin:0 auto 6px;width:48mm;max-width:100%;height:auto}.tail{height:50mm}body::after{content:"";display:block;height:80mm}@media print{html,body{width:80mm;padding-bottom:50mm}}</style></head>
      <body>
        ${rest.logo ? `<img class="logo" src="${rest.logo}" alt="Logo" />` : ''}
        <div class="center" style="font-weight:900">${esc(rest.name || 'Restaurant')}</div>
        ${rest.address ? `<div class="center small" style="font-weight:900">${esc(rest.address)}</div>` : ''}
        ${rest.phone ? `<div class="center small" style="font-weight:900">${esc(rest.phone)}</div>` : ''}
        <div class="center small" style="font-weight:900">Business Date: ${esc(bizId)}</div>
        <div class="sep"></div>
        <div class="row"><div>Customer</div><div>${esc(rec.customerName || '-')}</div></div>
        <div class="row"><div>Token</div><div>${esc(rec.token || '-')}</div></div>
        <div class="row"><div>Order Type</div><div>${esc(rec.orderType || '-')}</div></div>
        <div class="row"><div>Date & Time</div><div>${esc(dt)}</div></div>
        ${rec.cashierName ? `<div class="row"><div>Cashier</div><div>${esc(rec.cashierName)}</div></div>` : ''}
        ${rec.waiterName ? `<div class="row"><div>Served By</div><div>${esc(rec.waiterName)}${rec.waiterRole ? ` (${esc(rec.waiterRole)})` : ''}</div></div>` : ''}
        <div class="sep"></div>
        ${itemsHtml}
        <div class="sep"></div>
        <div class="row"><div>Subtotal</div><div>Rs.${Number(rec.subtotal||0).toFixed(2)}</div></div>
        ${Number(rec.deliveryCharges || rec.delivery || 0) > 0 ? `<div class="row"><div>Delivery Charges</div><div>Rs.${Number(rec.deliveryCharges || rec.delivery || 0).toFixed(2)}</div></div>` : ''}
        ${discount > 0 ? `<div class="row"><div>Discount</div><div>-Rs.${discount.toFixed(2)}</div></div>` : ''}
        <div class="row"><div><b>Total</b></div><div><b>Rs.${Number(rec.total||0).toFixed(2)}</b></div></div>
        <div class="sep"></div>
        <div class="center small" style="font-weight:900">Thank you!</div>
        ${rec.isLoyaltyBill ? `<div class="center small" style="font-weight:900;color:#d97706">*** LOYALTY CUSTOMER — 100th Bill Reward ***</div>` : ''}
        ${rec.loyaltyApproved ? `<div class="center small" style="font-weight:900;color:#16a34a">Loyalty Reward ✓ Approved</div>` : ''}
        <div class="center small" style="font-weight:900;color:#dc2626">*** REPRINT ***</div>
        <div class="center small" style="font-weight:900">Software by AlienMatrix</div>
        <div class="tail"></div>
      </body></html>`
    setReceiptHtml(receiptHtml)
    setReceiptOpen(true)
  }

  // Print receipt with dialog - user selects printer
  async function printReceiptIframe(){
    if (!receiptHtml) return
    
    try {
      const cfg = (typeof getPrinterConfig === 'function') ? getPrinterConfig() : null
      if (cfg && cfg.enabled && cfg.printerName && window.burgerPos && window.burgerPos.printSilentToPrinter) {
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(receiptHtml)
        let result = await Promise.race([
          window.burgerPos.printSilentToPrinter(dataUrl, cfg.printerName),
          new Promise(resolve => setTimeout(() => resolve({ success:false, error:'Timeout' }), 6000)),
        ])
        if (!(result && result.success)) {
          result = await Promise.race([
            window.burgerPos.printSilentToPrinter(receiptHtml, cfg.printerName),
            new Promise(resolve => setTimeout(() => resolve({ success:false, error:'Timeout2' }), 6000)),
          ])
        }
        if (result && result.success) { setReceiptOpen(false); return }
      }
    } catch {}

    console.log('=== REPRINT RECEIPT START ===')
    console.log('Opening print dialog for user to select printer...')
    
    try {
      // Check if print API is available
      if (!(window.burgerPos && window.burgerPos.printWithDialog)) {
        console.log('Print dialog API not available, falling back to window.print()')
        
        // Create a new window with the receipt content
        const printWindow = window.open('', '_blank', 'width=400,height=600')
        if (!printWindow) {
          alert('Pop-up blocked! Please allow pop-ups for this site and try again.')
          return
        }
        
        printWindow.document.write(receiptHtml)
        printWindow.document.close()
        
        // Wait a moment for content to load, then show print dialog
        setTimeout(() => {
          printWindow.focus()
          printWindow.print()
          
          // Close the window after printing
          setTimeout(() => {
            printWindow.close()
          }, 1000)
        }, 500)
        
        setReceiptOpen(false)
        return
      }

      // Use Electron's print dialog
      console.log('Using Electron print dialog...')
      const result = await window.burgerPos.printWithDialog(receiptHtml)
      
      if (result && result.success) {
        console.log('✅ Print dialog completed successfully')
        setReceiptOpen(false)
      } else {
        console.log('Print dialog was cancelled or failed')
      }
      
    } catch (error) {
      console.error('Print error:', error)
      alert(`Print error: ${error.message}`)
    } finally {
      console.log('=== REPRINT RECEIPT END ===')
    }
  }

  // Generate a consolidated PDF for the currently selected date (or all if date is empty)
  async function downloadPdfForDate(){
    const ymd = date || 'All'
    const rest = getRestaurantInfo()

    try {
      await ensureJsPdfLoaded()
      const { jsPDF } = window.jspdf
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 50
      const maxWidth = pageWidth - (2 * margin)
      let y = margin

      // Helper to check page break
      const checkPageBreak = (requiredSpace = 25) => {
        if (y + requiredSpace > pageHeight - margin) {
          doc.addPage()
          y = margin
          return true
        }
        return false
      }

      // Draw header with logo/company info
      try { doc.setFont('helvetica', 'bold') } catch {}
      doc.setFontSize(22)
      doc.setTextColor(40, 40, 40)
      doc.text(rest.name || 'Restaurant', pageWidth / 2, y, { align: 'center' })
      y += 20
      
      try { doc.setFont('helvetica', 'normal') } catch {}
      doc.setFontSize(11)
      doc.setTextColor(80, 80, 80)
      if (rest.address) {
        doc.text(rest.address, pageWidth / 2, y, { align: 'center' })
        y += 16
      }
      if (rest.phone) {
        doc.text(rest.phone, pageWidth / 2, y, { align: 'center' })
        y += 16
      }
      
      y += 10
      // Draw decorative line
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(1)
      doc.line(margin, y, pageWidth - margin, y)
      y += 25

      // Report Title
      try { doc.setFont('helvetica', 'bold') } catch {}
      doc.setFontSize(18)
      doc.setTextColor(40, 40, 40)
      doc.text('Sales & Returns Report', pageWidth / 2, y, { align: 'center' })
      y += 18
      
      doc.setFontSize(12)
      doc.setTextColor(100, 100, 100)
      doc.text(`Report Date: ${ymd}`, pageWidth / 2, y, { align: 'center' })
      y += 30

      // Sales Section
      try { doc.setFont('helvetica', 'bold') } catch {}
      doc.setFontSize(14)
      doc.setTextColor(40, 40, 40)
      doc.text(`Sales (${filteredSales.length})`, margin, y)
      y += 25

      if (filteredSales.length > 0) {
        try { doc.setFont('helvetica', 'normal') } catch {}
        doc.setFontSize(10)
        
        for (const s of filteredSales) {
          checkPageBreak(60)
          
          const d = new Date(s.createdAt||Date.now()).toLocaleString()
          
          // Sale header box
          doc.setFillColor(248, 249, 250)
          doc.rect(margin, y - 12, maxWidth, 50, 'F')
          doc.setDrawColor(220, 220, 220)
          doc.setLineWidth(0.5)
          doc.rect(margin, y - 12, maxWidth, 50, 'S')
          
          doc.setTextColor(40, 40, 40)
          try { doc.setFont('helvetica', 'bold') } catch {}
          doc.text(`Token: ${s.token || '-'}`, margin + 10, y)
          doc.text(`Type: ${s.orderType || '-'}`, margin + 150, y)
          try { doc.setFont('helvetica', 'normal') } catch {}
          doc.setTextColor(100, 100, 100)
          doc.text(d, pageWidth - margin - 10, y, { align: 'right' })
          y += 14
          
          // Items
          const items = (s.items||[]).map(i=>`${i.qty}x ${i.name} (Rs.${Number(i.price*i.qty).toFixed(2)})`).join(', ')
          const itemLines = wrapText(doc, items || 'No items', maxWidth - 30)
          doc.setTextColor(60, 60, 60)
          for (const line of itemLines) {
            doc.text(line, margin + 15, y)
            y += 12
          }
          
          // Totals
          y += 4
          doc.setTextColor(80, 80, 80)
          doc.text(`Subtotal: Rs.${Number(s.subtotal||0).toFixed(2)} | Delivery: Rs.${Number(s.delivery||0).toFixed(2)} | Discount: Rs.${Number((s.discount ?? s.discountAmount) || 0).toFixed(2)} | Total: Rs.${Number(s.total||0).toFixed(2)}`, margin + 15, y)
          y += 12
          try { doc.setFont('helvetica', 'bold') } catch {}
          doc.setTextColor(40, 40, 40)
          doc.text(`Total: Rs.${Number(s.total||0).toFixed(2)}`, margin + 15, y)
          try { doc.setFont('helvetica', 'normal') } catch {}
          y += 28
        }
      } else {
        doc.setTextColor(120, 120, 120)
        doc.text('No sales found', margin + 20, y)
        y += 25
      }

      // Separator
      y += 10
      doc.setDrawColor(180, 180, 180)
      doc.setLineWidth(1)
      doc.line(margin, y, pageWidth - margin, y)
      y += 25

      // Returns Section
      checkPageBreak(60)
      try { doc.setFont('helvetica', 'bold') } catch {}
      doc.setFontSize(14)
      doc.setTextColor(220, 80, 60)
      doc.text(`Returns (${filteredReturns.length})`, margin, y)
      y += 25

      if (filteredReturns.length > 0) {
        try { doc.setFont('helvetica', 'normal') } catch {}
        doc.setFontSize(10)
        
        for (const r of filteredReturns) {
          checkPageBreak(50)
          
          const d = new Date(r.createdAt||Date.now()).toLocaleString()
          
          // Return header box
          doc.setFillColor(255, 245, 245)
          doc.rect(margin, y - 12, maxWidth, 45, 'F')
          doc.setDrawColor(240, 200, 200)
          doc.setLineWidth(0.5)
          doc.rect(margin, y - 12, maxWidth, 45, 'S')
          
          doc.setTextColor(180, 60, 40)
          try { doc.setFont('helvetica', 'bold') } catch {}
          doc.text(`Token: ${r.token || '-'}`, margin + 10, y)
          doc.text(`Type: ${r.orderType || '-'}`, margin + 150, y)
          try { doc.setFont('helvetica', 'normal') } catch {}
          doc.setTextColor(100, 100, 100)
          doc.text(d, pageWidth - margin - 10, y, { align: 'right' })
          y += 14
          
          // Items
          const items = (r.items||[]).map(i=>`${i.qty}x ${i.name} (Rs.${Number(i.price*i.qty).toFixed(2)})`).join(', ')
          const itemLines = wrapText(doc, items || 'No items', maxWidth - 30)
          doc.setTextColor(80, 60, 60)
          for (const line of itemLines) {
            doc.text(line, margin + 15, y)
            y += 12
          }
          
          y += 4
          try { doc.setFont('helvetica', 'bold') } catch {}
          doc.setTextColor(200, 60, 40)
          doc.text(`Total Returned: Rs.${Number(r.total||0).toFixed(2)}`, margin + 15, y)
          try { doc.setFont('helvetica', 'normal') } catch {}
          y += 28
        }
      } else {
        doc.setTextColor(120, 120, 120)
        doc.text('No returns found', margin + 20, y)
        y += 25
      }

      // Summary Section
      y += 15
      checkPageBreak(90)
      doc.setDrawColor(100, 100, 100)
      doc.setLineWidth(2)
      doc.line(margin, y, pageWidth - margin, y)
      y += 25

      try { doc.setFont('helvetica', 'bold') } catch {}
      doc.setFontSize(14)
      doc.setTextColor(40, 40, 40)
      doc.text('Summary', margin, y)
      y += 25

      doc.setFontSize(12)
      doc.text('Sales Total:', pageWidth - margin - 200, y)
      doc.text(`Rs. ${totals.saleTotal.toFixed(2)}`, pageWidth - margin - 10, y, { align: 'right' })
      y += 18

      doc.setTextColor(220, 80, 60)
      doc.text('Returns Total:', pageWidth - margin - 200, y)
      doc.text(`Rs. ${totals.returnTotal.toFixed(2)}`, pageWidth - margin - 10, y, { align: 'right' })
      y += 22

      doc.setFontSize(14)
      doc.setTextColor(60, 150, 80)
      doc.text('Net Total:', pageWidth - margin - 200, y)
      doc.text(`Rs. ${totals.net.toFixed(2)}`, pageWidth - margin - 10, y, { align: 'right' })

      // Footer
      y = pageHeight - 30
      try { doc.setFont('helvetica', 'italic') } catch {}
      doc.setFontSize(9)
      doc.setTextColor(150, 150, 150)
      doc.text('Software developed by AlienMatrix', pageWidth / 2, y, { align: 'center' })
      doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, y + 12, { align: 'center' })

      const filename = `Receipt_${ymd}.pdf`
      doc.save(filename)
      return
    } catch (e) {
      // Fallback to simple HTML printable report
      const header = [
        `${rest.name || 'Restaurant'}`,
        `${rest.address || ''}`,
        `${rest.phone || ''}`,
        `Report Date: ${ymd}`,
        ''.padEnd(40, '-')
      ]

      const saleLines = []
      for (const s of filteredSales) {
        const d = new Date(s.createdAt||Date.now()).toLocaleString()
        saleLines.push(`Time: ${d}  | Token: ${s.token || '-'}  | Type: ${s.orderType || '-'}`)
        const items = (s.items||[]).map(i=>`${i.qty} x ${i.name} (Rs.${Number(i.price*i.qty).toFixed(2)})`).join(', ')
        if (items) saleLines.push(`  Items: ${items}`)
        saleLines.push(`  Subtotal: Rs.${Number(s.subtotal||0).toFixed(2)}  Delivery: Rs.${Number(s.delivery||0).toFixed(2)}  Discount: Rs.${Number((s.discount ?? s.discountAmount) || 0).toFixed(2)}  Total: Rs.${Number(s.total||0).toFixed(2)}`)
        saleLines.push('')
      }

      const returnLines = []
      for (const r of filteredReturns) {
        const d = new Date(r.createdAt||Date.now()).toLocaleString()
        returnLines.push(`Time: ${d}  | Token: ${r.token || '-'}  | Type: ${r.orderType || '-'}`)
        const items = (r.items||[]).map(i=>`${i.qty} x ${i.name} (Rs.${Number(i.price*i.qty).toFixed(2)})`).join(', ')
        if (items) returnLines.push(`  Items: ${items}`)
        returnLines.push(`  Total Returned: Rs.${Number(r.total||0).toFixed(2)}`)
        returnLines.push('')
      }

      const footer = [
        ''.padEnd(40, '-'),
        `Sales Total: Rs.${totals.saleTotal.toFixed(2)}`,
        `Returns Total: Rs.${totals.returnTotal.toFixed(2)}`,
        `Net Total: Rs.${totals.net.toFixed(2)}`
      ]

      const contentLines = [
        ...header,
        `Sales (${filteredSales.length})`,
        ...((filteredSales.length>0)?saleLines:['  None']),
        ''.padEnd(40, '-'),
        `Returns (${filteredReturns.length})`,
        ...((filteredReturns.length>0)?returnLines:['  None']),
        ...footer
      ]

      const printable = `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <title>Receipt Report</title>
      <style>*{box-sizing:border-box} body{font-family: ui-monospace, Menlo, Consolas, monospace; padding:16px; white-space:pre-wrap}
      .controls{display:flex; gap:8px; justify-content:flex-end; margin-bottom:8px}
      .btn{padding:6px 10px; border:1px solid #333; background:#f5f5f5; cursor:pointer}
      @media print{ .controls{ display:none } }
      </style></head><body>
      <div class="controls"><button class="btn" onclick="window.close()">OK</button><button class="btn" onclick="window.print()">Print</button></div>
      ${contentLines.map(l=>l.replace(/&/g,'&amp;').replace(/</g,'&lt;')).join('\n')}
      </body></html>`
      const w = window.open('', '_blank', 'width=900,height=700')
      if (!w) return
      w.document.open(); w.document.write(printable); w.document.close()
    }
  }

  // Lazy-load jsPDF from CDN if not present
  function ensureJsPdfLoaded(){
    return new Promise((resolve, reject)=>{
      if (window.jspdf && window.jspdf.jsPDF) return resolve()
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
      script.async = true
      script.onload = ()=> { if (window.jspdf && window.jspdf.jsPDF) resolve(); else reject(new Error('jsPDF not available')) }
      script.onerror = ()=> reject(new Error('Failed to load jsPDF'))
      document.head.appendChild(script)
    })
  }

  // Basic text wrapping for jsPDF using getTextDimensions
  function wrapText(doc, text, maxWidth){
    if (!text) return ['']
    const words = String(text).split(/\s+/)
    const lines = []
    let cur = ''
    for (const w of words){
      const test = cur ? cur + ' ' + w : w
      const width = doc.getTextDimensions(test).w
      if (width <= maxWidth) {
        cur = test
      } else {
        if (cur) lines.push(cur)
        cur = w
      }
    }
    if (cur) lines.push(cur)
    return lines.length ? lines : ['']
  }

  const handleRequestReprint = async (rec) => {
    if (!rec) return
    // Check if already pending
    if (pendingReprints[rec.token]) {
      alert('Request already pending for this token.')
      return
    }
    // Show reason input
    setReprintReasonToken(rec.token)
    setReprintReason('')
  }

  const confirmReprintRequest = async () => {
    const rec = filteredSales.find(s => s.token === reprintReasonToken)
    if (!rec) return
    try {
      await createReprintRequest({
        orderId: rec.id || rec._id,
        token: rec.token,
        cashierName: user?.name || user?.username || '',
        cashierId: user?.id || user?._id,
        customerName: rec.customerName || '',
        reason: reprintReason,
        businessDate: rec.bizId || '',
      })
      // Also create notification for admin
      await createNotification({
        type: 'reprint_request',
        title: 'Reprint Request',
        message: `Cashier ${user?.name || user?.username} requested reprint for Token #${rec.token} (Customer: ${rec.customerName || '-'})`,
        fromUserId: user?.id || user?._id,
        fromUserName: user?.name || user?.username,
        toRole: 'Admin',
        status: 'pending',
        relatedOrderId: rec.id || rec._id,
        relatedToken: rec.token,
      })
      window.dispatchEvent(new Event('notifications:changed'))
      setReprintReasonToken(null)
      // Refresh reprint status
      const p = await getPendingReprintForToken(rec.token)
      if (p) setPendingReprints(prev => ({ ...prev, [rec.token]: p }))
    } catch (e) { console.error('Reprint request failed', e) }
  }

  return (
    <section>
      <h1>Sale History</h1>

      {/* Tabs */}
      <div className="row" style={{gap:8, marginBottom:12}}>
        <button className={`btn ${activeTab==='sales'?'primary':''}`} onClick={()=>setActiveTab('sales')}>Sales</button>
        <button className={`btn ${activeTab==='requests'?'primary':''}`} onClick={()=>setActiveTab('requests')}>Requests</button>
      </div>

      {activeTab === 'sales' && (<>
      <div className="row" style={{gap:8, alignItems:'center', marginBottom:8}}>
        <div className="row" style={{gap:8, alignItems:'center'}}>
          <label className="muted">Date</label>
          <div className="input-wrap">
            <input
              ref={dateRef}
              className="input"
              type="date"
              value={date}
              onChange={(e)=>setDate(e.target.value)}
            />
            <button
              type="button"
              className="input-icon-btn calendar-toggle"
              aria-label="Open date picker"
              title="Open date picker"
              onClick={()=>{ const el = dateRef.current; if (el && typeof el.showPicker === 'function') el.showPicker(); else el?.focus() }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </button>
          </div>
          {/* Date badge removed per request */}
          {date && <button className="btn" onClick={()=>setDate('')}>Clear</button>}
        </div>
        <div className="row" style={{gap:8, alignItems:'center'}}>
          <div className="muted">Count: <b>{filteredSales.length}</b></div>
          <button className="btn" onClick={downloadPdfForDate} title="Download PDF report for selected date">Download PDF</button>
        </div>
      </div>

      {receiptOpen && (
        <div className="modal-overlay" style={{ backgroundColor: 'rgba(0,0,0,0.8)', padding: '20px' }} onClick={()=>setReceiptOpen(false)}>
          
          <div className="modal" style={{
            width: '100%',
            maxWidth: '450px',
            maxHeight: '90vh',
            overflow: 'hidden',
            position: 'relative',
            margin: '0 auto'
          }} onClick={(e)=>e.stopPropagation()}>
            
            <div style={{
              textAlign: 'center',
              marginBottom: '20px',
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#333',
              borderBottom: '2px solid #f0f0f0',
              paddingBottom: '10px'
            }}>
              Receipt Preview
            </div>
            
            <div style={{
              border: '1px solid #e0e0e0',
              padding: '15px',
              marginBottom: '20px',
              backgroundColor: '#fafafa',
              borderRadius: '8px',
              maxHeight: '400px',
              overflowY: 'auto',
              overflowX: 'hidden',
              textAlign: 'center'
            }}>
              <div dangerouslySetInnerHTML={{ __html: receiptHtml }} />
            </div>
            
            <div style={{
              display: 'flex',
              gap: '15px',
              justifyContent: 'center'
            }}>
              <button 
                onClick={()=>setReceiptOpen(false)}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  minWidth: '80px'
                }}
              >
                OK
              </button>
              <button 
                onClick={printReceiptIframe}
                style={{
                  backgroundColor: '#007bff',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  minWidth: '80px'
                }}
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Pagination controls */}
      <div className="row" style={{marginBottom:8, justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8}}>
        <div className="row" style={{gap:8, alignItems:'center'}}>
          <label className="muted">Page Size</label>
          <select className="input" value={pageSize} onChange={(e)=>{
            const v = parseInt(e.target.value,10)
            setPageSize(Number.isNaN(v) ? 10 : v)
          }} style={{width:120}}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={-1}>All</option>
          </select>
        </div>
        <div className="row" style={{gap:8, alignItems:'center'}}>
          <button className="btn" onClick={()=>setPage(p=>Math.max(1, p-1))} disabled={page<=1 || pageSize===-1}>Prev</button>
          <div className="muted">Page <b>{pageSize===-1?1:page}</b> of <b>{totalPages}</b></div>
          <button className="btn" onClick={()=>setPage(p=>Math.min(totalPages, p+1))} disabled={page>=totalPages || pageSize===-1}>Next</button>
        </div>
      </div>

        <div className="card">
        <div className="bill-head" style={{gridTemplateColumns:'140px 80px 1fr 2fr 120px 100px 100px 100px 160px'}}>
          <div>Date</div>
          <div>Token</div>
          <div>Customer</div>
          <div>Items</div>
          <div>Order Type</div>
          <div>Total</div>
          <div>Cashier</div>
          <div>Served By</div>
          <div>Actions</div>
        </div>
        {filteredSales.length===0 && <div className="muted">No sales yet.</div>}
        {pagedSales.map(rec => (
          <div key={String(rec.id || rec._id || Math.random())} className="bill-row" style={{gridTemplateColumns:'140px 80px 1fr 2fr 120px 100px 100px 100px 160px'}}>
            <div>{rec?.bizId || getBusinessDateId(rec.createdAt||Date.now())}</div>
            <div>{rec.token||'-'}{rec.isLoyaltyBill ? ' 🏆' : ''}{rec.loyaltyApproved ? ' ✓' : ''}</div>
            <div className="grow">{rec.customerName||'-'}</div>
            <div>{(rec.items||[]).map(i=>`${i.qty} x ${i.name}`).join(', ') || '-'}</div>
            <div>{rec.orderType || '-'}</div>
            <div className="price">Rs.{Number(rec.total||0).toFixed(2)}</div>
            <div style={{fontSize:11}}>{rec.cashierName || '-'}</div>
            <div style={{fontSize:11}}>{rec.waiterName ? `${rec.waiterName}${rec.waiterRole ? ` (${rec.waiterRole})` : ''}` : '-'}</div>
            <div className="row" style={{justifyContent:'flex-start', gap:8}}>
              {isAdmin ? (
                <button className="btn" style={{background:'#ff9800', borderColor:'#ff9800', color:'#fff'}} onClick={()=>reprint(rec)}>Reprint</button>
              ) : approvedReprints[rec.token] ? (
                <button className="btn" style={{background:'#16a34a', borderColor:'#16a34a', color:'#fff'}} onClick={()=>reprint(rec)}>Reprint ✅</button>
              ) : pendingReprints[rec.token] ? (
                <button className="btn" disabled style={{opacity:0.6}}>Requested ⏳</button>
              ) : (
                <button className="btn" style={{background:'#ff9800', borderColor:'#ff9800', color:'#fff'}} onClick={()=>handleRequestReprint(rec)}>Request Reprint</button>
              )}
              <button className="btn danger" onClick={()=>onDelete(rec.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom pagination duplicate for convenience */}
      {filteredSales.length>0 && pageSize!==-1 && (
        <div className="row" style={{marginTop:8, justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8}}>
          <div/>
          <div className="row" style={{gap:8, alignItems:'center'}}>
            <button className="btn" onClick={()=>setPage(p=>Math.max(1, p-1))} disabled={page<=1}>Prev</button>
            <div className="muted">Page <b>{page}</b> of <b>{totalPages}</b></div>
            <button className="btn" onClick={()=>setPage(p=>Math.min(totalPages, p+1))} disabled={page>=totalPages}>Next</button>
          </div>
        </div>
      )}
      </>)}

      {/* Requests Tab */}
      {activeTab === 'requests' && (
        <div className="card">
          <div className="card-title">Reprint & Loyalty Requests</div>
          <div className="bill-head" style={{gridTemplateColumns:'80px 1fr 1fr 1fr 120px 120px 120px'}}>
            <div>Token</div>
            <div>Customer</div>
            <div>Cashier</div>
            <div>Reason</div>
            <div>Status</div>
            <div>Requested</div>
            <div>Actions</div>
          </div>
          {allReprintRequests.length === 0 && <div className="muted">No reprint requests yet.</div>}
          {allReprintRequests.map(rr => (
            <div key={String(rr._id || rr.id || Math.random())} className="bill-row" style={{gridTemplateColumns:'80px 1fr 1fr 1fr 120px 120px 120px'}}>
              <div>{rr.token}</div>
              <div>{rr.customerName || '-'}</div>
              <div>{rr.cashierName || '-'}</div>
              <div>{rr.reason || '-'}</div>
              <div>{rr.status === 'approved' ? '✅ Approved' : rr.status === 'declined' ? '❌ Declined' : rr.status === 'expired' ? '⏰ Expired' : '⏳ Pending'}</div>
              <div>{rr.createdAt ? new Date(rr.createdAt).toLocaleString() : '-'}</div>
              <div>
                {isAdmin && rr.status === 'pending' && (
                  <div className="row" style={{gap:4}}>
                    <button className="btn" style={{background:'#16a34a', borderColor:'#16a34a', color:'#fff', padding:'2px 8px', fontSize:11}} onClick={async () => {
                      await approveReprintRequest(rr._id, user?.name || user?.username || 'Admin')
                      window.dispatchEvent(new Event('notifications:changed'))
                      const reqs = await listReprintRequests()
                      setAllReprintRequests(Array.isArray(reqs) ? reqs : [])
                    }}>Approve</button>
                    <button className="btn danger" style={{padding:'2px 8px', fontSize:11}} onClick={async () => {
                      await declineReprintRequest(rr._id, user?.name || user?.username || 'Admin')
                      window.dispatchEvent(new Event('notifications:changed'))
                      const reqs = await listReprintRequests()
                      setAllReprintRequests(Array.isArray(reqs) ? reqs : [])
                    }}>Decline</button>
                  </div>
                )}
                {rr.status === 'approved' && (
                  <button className="btn" style={{background:'#ff9800', borderColor:'#ff9800', color:'#fff', padding:'2px 8px', fontSize:11}} onClick={() => {
                    const sale = sales.find(s => s.token === rr.token)
                    if (sale) reprint(sale)
                  }}>Reprint</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reprint Reason Modal */}
      {reprintReasonToken && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:11000, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={()=>setReprintReasonToken(null)}>
          <div className="card" style={{width:380, padding:20}} onClick={e=>e.stopPropagation()}>
            <div className="card-title">Reason for Reprint (Optional)</div>
            <input className="input" placeholder="Enter reason..." value={reprintReason} onChange={e=>setReprintReason(e.target.value)} style={{width:'100%', marginBottom:12}} />
            <div className="actions" style={{justifyContent:'flex-end', gap:8}}>
              <button className="btn" onClick={()=>setReprintReasonToken(null)}>Cancel</button>
              <button className="btn primary" onClick={confirmReprintRequest}>Send Request</button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{marginTop:12}}>
        <div className="row" style={{justifyContent:'space-between'}}>
          <div>Sales Total</div>
          <div className="price">Rs.{totals.saleTotal.toFixed(2)}</div>
        </div>
        <div className="row" style={{justifyContent:'space-between'}}>
          <div>Returns Total</div>
          <div className="price">Rs.{totals.returnTotal.toFixed(2)}</div>
        </div>
        <div className="row" style={{justifyContent:'space-between'}}>
          <div className="big">Net Total</div>
          <div className="big price">Rs.{totals.net.toFixed(2)}</div>
        </div>
      </div>
    </section>
  )
}
