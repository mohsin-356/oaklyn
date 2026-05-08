import { useEffect, useMemo, useRef, useState } from 'react'
import { listSales, getBusinessDateId, getActiveBusinessDateId, getRestaurantInfo } from '../utils/storage.js'

export default function Consumption(){
  const [sales, setSales] = useState([])
  const [q, setQ] = useState('')
  const [selectedDate, setSelectedDate] = useState(() => {
    try { return getActiveBusinessDateId() } catch { return getBusinessDateId(Date.now()) }
  })
  const dateRef = useRef(null)

  useEffect(()=>{
    const load = async () => { try { setSales(await listSales()) } catch {} }
    load()
    setSelectedDate(getActiveBusinessDateId())
    const onSales = () => load()
    const onSyncDate = () => { setSelectedDate(getActiveBusinessDateId()) }
    window.addEventListener('data:sales-changed', onSales)
    window.addEventListener('storage', onSales)
    window.addEventListener('day:status-changed', onSyncDate)
    return () => {
      window.removeEventListener('data:sales-changed', onSales)
      window.removeEventListener('storage', onSales)
      window.removeEventListener('day:status-changed', onSyncDate)
    }
  }, [])

  const filteredSales = useMemo(() => {
    if (!selectedDate) return sales
    return sales.filter(s => (s.bizId || getBusinessDateId(s.createdAt || Date.now())) === selectedDate)
  }, [sales, selectedDate])

  const rows = useMemo(()=>{
    const map = new Map()
    for (const s of filteredSales) {
      for (const it of (s.items||[])) {
        const key = it.name
        const prev = map.get(key) || { name: key, qty: 0, total: 0 }
        prev.qty += Number(it.qty||0)
        prev.total += Number(it.qty||0) * Number(it.price||0)
        map.set(key, prev)
      }
    }
    let arr = Array.from(map.values())
    const qq = q.toLowerCase()
    if (qq) arr = arr.filter(r => (r.name||'').toLowerCase().includes(qq))
    arr.sort((a,b)=> a.name.localeCompare(b.name))
    return arr
  },[filteredSales, q])

  const totals = useMemo(()=>{
    const base = rows.reduce((acc,r)=>{ acc.qty+=r.qty; acc.total+=r.total; return acc }, { qty:0, total:0 })
    const bills = filteredSales.length
    return { ...base, bills }
  },[rows, filteredSales])

  async function downloadPdf(){
    const ymd = selectedDate || 'All'
    const rest = getRestaurantInfo()

    try {
      await ensureJsPdfLoaded()
      const { jsPDF } = window.jspdf
      const doc = new jsPDF({ unit:'pt', format:'a4' })
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
      doc.text('Consumption Report', pageWidth / 2, y, { align: 'center' })
      y += 18
      
      doc.setFontSize(12)
      doc.setTextColor(100, 100, 100)
      doc.text(`Date: ${ymd}`, pageWidth / 2, y, { align: 'center' })
      y += 30

      // Table Header Background
      doc.setFillColor(245, 245, 245)
      doc.rect(margin, y - 18, maxWidth, 25, 'F')
      
      // Table Header
      doc.setDrawColor(220, 220, 220)
      doc.setLineWidth(0.5)
      doc.rect(margin, y - 18, maxWidth, 25, 'S')
      
      try { doc.setFont('helvetica', 'bold') } catch {}
      doc.setFontSize(11)
      doc.setTextColor(60, 60, 60)
      doc.text('Item Name', margin + 10, y)
      doc.text('Qty Sold', pageWidth - margin - 140, y)
      doc.text('Total (Rs.)', pageWidth - margin - 10, y, { align: 'right' })
      y += 15

      // Table Rows
      try { doc.setFont('helvetica', 'normal') } catch {}
      doc.setFontSize(10)
      doc.setTextColor(40, 40, 40)
      
      let isAlternate = false
      for (const r of rows) {
        checkPageBreak(22)
        
        // Alternate row background
        if (isAlternate) {
          doc.setFillColor(252, 252, 252)
          doc.rect(margin, y - 14, maxWidth, 20, 'F')
        }
        isAlternate = !isAlternate
        
        // Draw row border
        doc.setDrawColor(230, 230, 230)
        doc.setLineWidth(0.3)
        doc.rect(margin, y - 14, maxWidth, 20, 'S')
        
        const name = String(r.name || '').substring(0, 40)
        doc.text(name, margin + 10, y)
        doc.text(Number(r.qty || 0).toFixed(2), pageWidth - margin - 140, y)
        doc.text(`Rs. ${Number(r.total || 0).toFixed(2)}`, pageWidth - margin - 10, y, { align: 'right' })
        y += 20
      }

      // Totals Section
      y += 10
      checkPageBreak(60)
      
      // Draw separator line
      doc.setDrawColor(100, 100, 100)
      doc.setLineWidth(1.5)
      doc.line(pageWidth - margin - 250, y, pageWidth - margin, y)
      y += 20
      
      try { doc.setFont('helvetica', 'bold') } catch {}
      doc.setFontSize(12)
      doc.setTextColor(40, 40, 40)
      
      doc.text('Bills:', pageWidth - margin - 240, y)
      doc.text(String(totals.bills), pageWidth - margin - 10, y, { align: 'right' })
      y += 18
      
      doc.text('Items Sold:', pageWidth - margin - 240, y)
      doc.text(String(totals.qty), pageWidth - margin - 10, y, { align: 'right' })
      y += 18
      
      doc.setFontSize(14)
      doc.setTextColor(200, 80, 60)
      doc.text('Total Revenue:', pageWidth - margin - 240, y)
      doc.text(`Rs. ${totals.total.toFixed(2)}`, pageWidth - margin - 10, y, { align: 'right' })
      
      // Footer
      y = pageHeight - 30
      try { doc.setFont('helvetica', 'italic') } catch {}
      doc.setFontSize(9)
      doc.setTextColor(150, 150, 150)
      doc.text('Software developed by AlienMatrix', pageWidth / 2, y, { align: 'center' })
      doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, y + 12, { align: 'center' })

      const filename = `Consumption_${ymd}.pdf`
      doc.save(filename)
      return
    } catch (e) {
      // Fallback for older browsers or PDF generation failure
      const lines = [
        'Consumption Report',
        `Date: ${ymd}`,
        ''.padEnd(40,'-'),
        ...rows.map(r => `${r.name}  |  Qty: ${Number(r.qty||0).toFixed(2)}  |  Total: Rs.${Number(r.total||0).toFixed(2)}`),
        ''.padEnd(40,'-'),
        `Bills: ${totals.bills}`,
        `Items Sold: ${totals.qty}`,
        `Revenue: Rs.${totals.total.toFixed(2)}`
      ]
      const printable = `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <title>Consumption Report</title>
      <style>*{box-sizing:border-box} body{font-family: ui-monospace, Menlo, Consolas, monospace; padding:16px; white-space:pre-wrap}
      .controls{display:flex; gap:8px; justify-content:flex-end; margin-bottom:8px}
      .btn{padding:6px 10px; border:1px solid #333; background:#f5f5f5; cursor:pointer}
      @media print{ .controls{ display:none } }
      </style></head><body>
      <div class="controls"><button class="btn" onclick="window.close()">OK</button><button class="btn" onclick="window.print()">Print</button></div>
      ${lines.map(l=>l.replace(/&/g,'&amp;').replace(/</g,'&lt;')).join('\n')}
      </body></html>`
      const w = window.open('', '_blank', 'width=900,height=700')
      if (!w) return
      w.document.open(); w.document.write(printable); w.document.close()
    }
  }

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

  function wrapText(doc, text, maxWidth){
    if (!text) return ['']
    const words = String(text).split(/\s+/)
    const lines = []
    let cur = ''
    for (const w of words){
      const test = cur ? cur + ' ' + w : w
      const width = doc.getTextDimensions(test).w
      if (width <= maxWidth) cur = test
      else { if (cur) lines.push(cur); cur = w }
    }
    if (cur) lines.push(cur)
    return lines
  }

  return (
    <section>
      <h1>Consumption</h1>
      <div className="row" style={{marginBottom:12, gap:12, alignItems:'center', justifyContent:'space-between', flexWrap:'wrap'}}>
        <div className="row" style={{gap:8, alignItems:'center'}}>
          <label className="muted">Date</label>
          <div className="input-wrap" style={{minWidth:220}}>
            <input ref={dateRef} className="input" type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} />
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
        </div>
        <div className="row" style={{gap:8, alignItems:'center'}}>
          <input className="input" placeholder="Search items..." value={q} onChange={e=>setQ(e.target.value)} />
          <button className="btn" onClick={downloadPdf} title="Download consumption report as PDF">Download PDF</button>
        </div>
      </div>
      <div className="card">
        <div className="bill-head" style={{gridTemplateColumns:'1fr 120px 140px'}}>
          <div>Item</div>
          <div>Qty Sold</div>
          <div>Total Rs.</div>
        </div>
        {rows.length===0 && <div className="muted">No sales yet.</div>}
        {rows.map(r => (
          <div key={r.name} className="bill-row" style={{gridTemplateColumns:'1fr 120px 140px'}}>
            <div className="grow">{r.name}</div>
            <div>{r.qty}</div>
            <div className="price">Rs.{r.total.toFixed(2)}</div>
          </div>
        ))}
        <div className="bill-foot" style={{gridTemplateColumns:'1fr 120px 140px'}}>
          <div className="big">Total</div>
          <div className="big">{totals.qty}</div>
          <div className="big price">Rs.{totals.total.toFixed(2)}</div>
        </div>
      </div>

      <div className="row" style={{marginTop:12, gap:16, flexWrap:'wrap'}}>
        <div className="card" style={{padding:12}}>
          <div className="card-title">Summary for {selectedDate}</div>
          <div className="row" style={{gap:16}}>
            <div className="muted">Bills: {totals.bills}</div>
            <div className="muted">Items Sold: {totals.qty}</div>
            <div className="muted">Revenue: Rs.{totals.total.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </section>
  )
}
