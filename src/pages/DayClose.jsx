import { useEffect, useMemo, useState } from 'react'
import { useDialog } from '../components/ConfirmProvider.jsx'
import AdminAuthModal from '../components/AdminAuthModal.jsx'
import { useModalScrollLock } from '../hooks/useModalScrollLock.js'
import { listSales, listReturns, addDayClosure, getBusinessWindow, getBusinessDateId, closeTokens, ensureTokenDay, getDayOpenAt, getDayOpenBizDate, openDay, setYesterdaySummary, getRestaurantInfo, setActiveBusinessDateId, getActiveBusinessDateId, incrementBusinessDateId, isTokenClosed, getPrinterConfig } from '../utils/storage.js'

export default function DayClose(){
  const [activeBizId, setActiveBizId] = useState(() => { try { return getActiveBusinessDateId() } catch { return '' } })
  const [sales, setSales] = useState([])
  const [returns, setReturns] = useState([])
  const [closedToday, setClosedToday] = useState(false)
  const [isClosed, setIsClosed] = useState(false)
  const [openedAt, setOpenedAt] = useState(0)
  const dialog = useDialog()
  // Receipt modal state
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptHtml, setReceiptHtml] = useState('')
  const [reprintAuth, setReprintAuth] = useState(null)

  // Manage body scroll when modal is open
  useModalScrollLock(receiptOpen || !!reprintAuth)

  // Expose a small bridge so helper functions below can open the receipt modal
  useEffect(() => {
    const setter = (html) => {
      try { window.__dayCloseReceiptHtml = html } catch {}
      setReceiptHtml(html)
      setReceiptOpen(true)
    }
    try { window.__setDayCloseReceipt = setter } catch {}
    return () => {
      try { delete window.__setDayCloseReceipt; delete window.__dayCloseReceiptHtml } catch {}
    }
  }, [])

  // compute business window for the active business date
  const bizWindow = useMemo(()=>{
    if (!activeBizId) return { start: 0, end: 0 }
    try {
      const baseTs = new Date(activeBizId + 'T00:00:00').getTime()
      return getBusinessWindow(baseTs)
    } catch { return { start: 0, end: 0 } }
  }, [activeBizId])
  const bizId = activeBizId

  useEffect(()=>{
    const load = async () => {
      try { setSales(await listSales()) } catch {}
      try { setReturns(await listReturns()) } catch {}
    }
    load()
    ensureTokenDay().catch(()=>{})
    isTokenClosed().then(v => setIsClosed(v)).catch(()=>{})
    getDayOpenAt().then(v => setOpenedAt(v||0)).catch(()=>{})
    const onSales = () => load()
    const onReturns = () => load()
    const onStorage = () => { 
      load(); 
      setActiveBizId(getActiveBusinessDateId())
      getDayOpenAt().then(v => setOpenedAt(v||0)).catch(()=>{})
      isTokenClosed().then(v => setIsClosed(v)).catch(()=>{})
    }
    const onDay = () => { 
      setActiveBizId(getActiveBusinessDateId())
      getDayOpenAt().then(v => setOpenedAt(v||0)).catch(()=>{})
      isTokenClosed().then(v => setIsClosed(v)).catch(()=>{})
    }
    window.addEventListener('data:sales-changed', onSales)
    window.addEventListener('data:returns-changed', onReturns)
    window.addEventListener('storage', onStorage)
    window.addEventListener('day:status-changed', onDay)
    return () => {
      window.removeEventListener('data:sales-changed', onSales)
      window.removeEventListener('data:returns-changed', onReturns)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('day:status-changed', onDay)
    }
  },[])

  // Filter records to current business date using persisted bizId when available
  const daySales = useMemo(()=> sales.filter(s => {
    try { return (s?.bizId || getBusinessDateId(s.createdAt||0)) === bizId } catch { return false }
  }), [sales, bizId])
  const dayReturns = useMemo(()=> returns.filter(r => {
    try { return (r?.bizId || getBusinessDateId(r.createdAt||0)) === bizId } catch { return false }
  }), [returns, bizId])

  const totals = useMemo(()=>{
    const subtotal = daySales.reduce((sum, s) => sum + (Number(s.subtotal)||0), 0)
    const deliveryCharges = daySales.reduce((sum, s) => sum + (Number(s.deliveryCharges)||0), 0)
    const gross = subtotal + deliveryCharges
    const discount = daySales.reduce((sum, s) => sum + (Number((s.discount ?? s.discountAmount) || 0)||0), 0)
    const net = Math.max(0, gross - discount)
    const returned = dayReturns.reduce((sum, r) => sum + (Number(r.total)||0), 0)
    const finalNet = Math.max(0, net - returned)
    return { subtotal, deliveryCharges, gross, discount, returned, net: finalNet }
  },[daySales, dayReturns])

  const closeDay = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    const ok = await dialog.confirm({ title: 'Close Day', description: 'Close the business day and lock token generation?' })
    if (!ok) return
    
    // Capture closing timestamp BEFORE advancing business date
    const closingTimestamp = Date.now()
    
    const summary = {
      bizId,
      start: bizWindow.start,
      end: bizWindow.end,
      totals,
      salesCount: daySales.length,
      returnCount: dayReturns.length,
      closedAt: closingTimestamp,
    }
    await addDayClosure(summary)
    // Persist snapshot for Dashboard 'Yesterday' row
    try {
      const tokensGenerated = daySales.length
      await setYesterdaySummary({
        bizId,
        subtotal: totals.subtotal,
        deliveryCharges: totals.deliveryCharges,
        gross: totals.gross,
        discount: totals.discount,
        net: totals.net,
        returned: totals.returned,
        salesCount: daySales.length,
        returnsCount: dayReturns.length,
        tokensGenerated,
        start: bizWindow.start,
        end: bizWindow.end,
        closedAt: closingTimestamp,
      })
    } catch {}
    await closeTokens()
    setClosedToday(true)
    // Advance the active business date deterministically to the next day
    let nextBizId = bizId
    try {
      nextBizId = incrementBusinessDateId(bizId, 1)
      await setActiveBusinessDateId(nextBizId)
      setActiveBizId(nextBizId)
    } catch {}
    // Show day summary in-app dialog
    try {
      const openBizDate = await getDayOpenBizDate() || bizId
      const html = buildDaySummaryHtml({
        bizId,
        nextBizId,
        openBizDate,
        closeBizDate: bizId,
        start: openedAt || bizWindow.start,
        end: closingTimestamp,
        totals,
        sales: daySales,
        returns: dayReturns,
        tokensGenerated: daySales.length,
      })
      try { window.__dayCloseReceiptHtml = html } catch {}
      setReceiptHtml(html)
      setReceiptOpen(true)
    } catch {}
  }

function printDaySummary({ bizId, nextBizId, openBizDate, closeBizDate, start, end, totals, sales = [], returns = [], tokensGenerated }){
  const rest = getRestaurantInfo()
  const openTime = new Date(start||Date.now()).toLocaleString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const closeTime = new Date(end||Date.now()).toLocaleString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <title>Day Close Summary</title>
  <style>
    @page{size:auto;margin:0}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;color:#000;height:auto !important;min-height:100% !important;overflow:visible !important}
    body{font-family:Arial,sans-serif;padding:16px 16px 80mm 16px;font-weight:400;overflow:visible !important;font-size:14px}
    img,svg{max-width:100%;height:auto}
    .center{text-align:center;page-break-inside:avoid}
    .logo{display:block;margin:0 auto 12px;width:48mm;max-width:100%;height:auto}
    .header-box{border:2px solid #000;padding:8px;margin:12px 0;text-align:center}
    .header-title{font-size:32px;font-weight:bold;line-height:1.2;margin:0}
    .section-title{font-size:16px;font-weight:bold;margin:16px 0 8px 0;text-align:center}
    .field-row{display:flex;align-items:center;margin:8px 0;gap:8px}
    .field-label{min-width:140px;font-weight:normal;font-size:13px}
    .field-value{flex:1;border:1px solid #000;padding:6px 8px;background:#fff;font-weight:bold;font-size:13px}
    .summary-box{border:1px solid #000;padding:12px;margin:16px 0}
    .summary-row{display:flex;justify-content:space-between;margin:6px 0;font-size:14px}
    .summary-label{font-weight:normal}
    .summary-value{font-weight:bold}
    .tail{height:80mm}
    .controls{display:flex; gap:8px; justify-content:flex-end; margin-bottom:8px}
    .btn{padding:6px 10px; border:1px solid #333; background:#f5f5f5; cursor:pointer}
    body::after{content:"";display:block;height:100mm}
    @media print{ .controls{ display:none }; html,body{width:80mm;padding-bottom:80mm} }
  </style></head>
  <body>
    <div class="controls"><button class="btn" onclick="window.close()">OK</button><button class="btn" onclick="window.print()">Print</button></div>
    ${rest.logo ? `<img class="logo" src="${rest.logo}" alt="Logo" />` : ''}
    <div class="center" style="font-size:11px;margin-bottom:4px">🗓️ Closed Today Shift</div>
    
    <div class="header-box">
      <div class="header-title">Sale<br>Report</div>
    </div>

    <div class="summary-box">
      <div class="summary-row">
        <span class="summary-label">Shift Date:</span>
        <span class="summary-value">${esc(closeBizDate||bizId)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Total Sale:</span>
        <span class="summary-value">${Number(totals?.gross||0).toFixed(2)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Total<br>Refund:</span>
        <span class="summary-value">${Number(totals?.returned||0).toFixed(2)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Total<br>Transaction:</span>
        <span class="summary-value">${tokensGenerated}</span>
      </div>
      <div class="summary-row" style="border-top:1px solid #000;padding-top:6px;margin-top:6px">
        <span class="summary-label">Net Sale</span>
        <span class="summary-value">${Number(totals?.net||0).toFixed(2)}</span>
      </div>
    </div>

    <div class="section-title">Closed Today Sale</div>

    <div class="field-row">
      <div class="field-label">Closing<br>Date</div>
      <div class="field-value">${esc(closeBizDate||bizId)}</div>
    </div>

    <div class="field-row">
      <div class="field-label">Today Sale</div>
      <div class="field-value">${Number(totals?.gross||0).toFixed(2)}</div>
    </div>

    <div class="field-row">
      <div class="field-label">Today<br>Refund</div>
      <div class="field-value">${Number(totals?.returned||0).toFixed(2)}</div>
    </div>

    <div class="field-row">
      <div class="field-label">Notes</div>
      <div class="field-value"></div>
    </div>

    <div class="field-row">
      <div class="field-label">Shift<br>Status</div>
      <div class="field-value">Closed</div>
    </div>

    <div class="field-row">
      <div class="field-label">Closed By</div>
      <div class="field-value">admin</div>
    </div>

    <div class="field-row">
      <div class="field-label">Closing<br>Time</div>
      <div class="field-value">${esc(closeTime)}</div>
    </div>

    <div class="field-row">
      <div class="field-label">Closed Sale<br>Password</div>
      <div class="field-value">***</div>
    </div>

    <div class="field-row">
      <div class="field-label">Re-Type<br>Password</div>
      <div class="field-value">***</div>
    </div>

    <div class="center" style="margin-top:20px;font-size:13px;font-weight:bold">Closed Today Sale</div>
  </body></html>`
  const w = window.open('', '_blank', 'width=420,height=680');
  if (!w) return
  w.document.open(); w.document.write(html); w.document.close()
}

// Print a receipt for a sale record using the Business Date from the record timestamp
function reprint(rec, currentBizId){
  const bizId = currentBizId || (()=>{ try { return rec?.bizId || getActiveBusinessDateId() } catch { return '' } })()
  const rest = getRestaurantInfo()
  
  // Use the same SVG-based approach as silent printing for consistency
  const lines = (rec.items||[]).map(i => ({ name: `${i.qty} x ${i.name}` , price: (i.price*i.qty).toFixed(2) }))
  const rows = []
  const addRow = (left, right, opts={}) => { 
    rows.push({ 
      left: String(left||'').replace(/[<>]/g,''), 
      right: right!=null?String(right):'', 
      bold: !!opts.bold, 
      size: opts.size||13, 
      gap: opts.gap||18 
    }) 
  }
  
  // Header
  addRow(rest.name || 'Restaurant', '', { bold: true, size: 18, gap: 22 })
  if (rest.address) addRow(rest.address, '')
  if (rest.phone) addRow(rest.phone, '')
  addRow(`Business Date: ${bizId}`, '')
  addRow('','',{gap:10})
  
  // Meta
  addRow('Customer', (rec.customerName || '-'))
  addRow('Token', (rec.token || '-'))
  addRow('Order Type', (rec.orderType || '-'))
  addRow('','',{gap:10})
  
  // Items
  for (const l of lines) addRow(l.name, `Rs.${l.price}`)
  addRow('','',{gap:10})
  
  // Totals
  addRow('Subtotal', `Rs.${Number(rec.subtotal || 0).toFixed(2)}`)
  if (rec.delivery > 0) addRow('Delivery', `Rs.${Number(rec.delivery || 0).toFixed(2)}`)
  addRow('Total', `Rs.${Number(rec.total || 0).toFixed(2)}`, { bold: true })
  addRow('','',{gap:14})
  addRow('Thank you!','',{size:14})
  addRow('Software developed by AlienMatrix','',{size:10})
  
  // Layout
  const width = 520
  const leftPad = 16
  const rightPad = 20
  const rightX = width - rightPad
  let y = 18
  const svgLines = rows.map((r, idx) => {
    y += (idx===0?0:r.gap)
    const weight = 'font-weight="700"'
    if (idx < 4 || idx >= rows.length - 2) {
      return `<text x="${width/2}" y="${y}" font-size="${r.size}" ${weight} text-anchor="middle">${r.left}</text>`
    }
    const left = `<text x="${leftPad}" y="${y}" font-size="${r.size}" ${weight}>${r.left}</text>`
    const right = r.right ? `<text x="${rightX}" y="${y}" font-size="${r.size}" text-anchor="end" ${weight}>${r.right}</text>` : ''
    return left + right
  }).join('')
  const height = y + 40
  
  // Generate SVG-based HTML for consistent printing
  const receiptHtml = `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <title>Receipt</title>
    <style>
      @page { size: 80mm auto; margin: 2mm } 
      html,body{margin:0;padding:0 8px;background:#fff} 
      img{display:block;margin:8px auto 4px;max-height:140px;max-width:100%;object-fit:contain;}
    </style>
    </head>
    <body style="margin:0;padding:0 8px;background:#fff;color:#000">
      ${rest.logo ? `<img src="${rest.logo}" alt="Logo" />` : ''}
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="max-width:100%;height:auto;display:block;margin:0 auto">
        <rect width="100%" height="100%" fill="white"/>
        <g font-family="Arial, sans-serif" fill="#000" font-weight="700" style="text-rendering:optimizeSpeed;shape-rendering:crispEdges">${svgLines}</g>
      </svg>
    </body></html>`
  const w = window.open('', '_blank', 'width=380,height=600');
  if(!w) return; w.document.open(); w.document.write(receiptHtml); w.document.close();
}

  const doOpenDay = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault()
    await openDay()
    const ts = Date.now()
    setOpenedAt(ts)
    await dialog.alert({ title: 'Day Opened', description: 'Tokens restarted from 1. New activity will appear from now on.' })
  }

  return (
    <>
    <section>
      <h1>Day Close</h1>

      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'12px', marginTop:12}}>
        <div className="card"><div className="card-title">Total Sales</div><div className="big">Rs.{totals.gross.toFixed(2)}</div></div>
        <div className="card"><div className="card-title">Delivery Charges</div><div className="big">Rs.{totals.deliveryCharges.toFixed(2)}</div></div>
        <div className="card"><div className="card-title">Total Discount</div><div className="big">Rs.{totals.discount.toFixed(2)}</div></div>
        <div className="card"><div className="card-title">Returned (Loss)</div><div className="big">Rs.{totals.returned.toFixed(2)}</div></div>
        <div className="card"><div className="card-title">Net After Returns</div><div className="big">Rs.{totals.net.toFixed(2)}</div></div>
      </div>

      <div className="card" style={{marginTop:12}}>
        <div className="row" style={{justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8}}>
          <div className="card-title">Day Controls</div>
          <div className="actions" style={{gap:8}}>
            <button
              type="button"
              className="btn danger"
              onClick={closeDay}
              disabled={!openedAt || isClosed}
              title={!openedAt ? 'Open the day first on Day Open page' : (isClosed ? 'Day already closed' : 'Close business day')}
            >
              Day Close
            </button>
          </div>
        </div>
        {!openedAt && <div className="muted" style={{marginTop:6}}>Open the day to enable closing.</div>}
        {openedAt && isClosed && <div className="muted" style={{marginTop:6}}>Day is already closed.</div>}
      </div>

      {/* Today's sales table with Reprint */}
      <div className="card" style={{marginTop:12}}>
        <div className="card-title">Today Sales (Business Date: {bizId || '-'})</div>
        <div className="bill-head" style={{gridTemplateColumns:'160px 80px 1fr 120px 120px'}}>
          <div>Date</div><div>Token</div><div>Customer</div><div>Total</div><div>Actions</div>
        </div>
        {daySales.length===0 && <div className="muted">No sales for current business day.</div>}
        {daySales.map(s => (
          <div key={String(s.id || s._id || Math.random())} className="bill-row" style={{gridTemplateColumns:'160px 80px 1fr 120px 120px'}}>
            <div>{s?.bizId || getBusinessDateId(s.createdAt||0)}</div>
            <div>{s.token||'-'}</div>
            <div className="grow">{s.customerName||'-'}</div>
            <div className="price">Rs.{Number(s.total||0).toFixed(2)}</div>
            <div className="row" style={{justifyContent:'flex-start'}}>
              <button className="btn" onClick={()=>setReprintAuth({rec: s, bizId})}>Reprint</button>
            </div>
          </div>
        ))}
      </div>

      {/* Date-wise sales summary table (all days) */}
      <DateWiseSalesTable sales={sales} returns={returns} />

    </section>
      {receiptOpen && (
        <div className="modal-overlay" style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', 
          padding: '20px', 
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }} onClick={()=>setReceiptOpen(false)}>
          
          <div className="modal" style={{
            width: '100%',
            maxWidth: '720px',
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
              Day Close Summary
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
                onClick={async ()=>{
                  await printReceiptIframe()
                  setReceiptOpen(false)
                }}
                style={{
                  backgroundColor: '#6c757d',
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
              <button 
                onClick={()=>downloadReceiptPdf(bizId)}
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
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Auth Modal for Reprint */}
      {reprintAuth && (
        <AdminAuthModal
          onVerified={(adminName) => {
            reprintLocal(reprintAuth.rec, reprintAuth.bizId)
            setReprintAuth(null)
          }}
          onCancel={() => setReprintAuth(null)}
        />
      )}
    </>
  )
}

// Module-scope helpers
function buildDaySummaryHtml({ bizId, nextBizId, openBizDate, closeBizDate, start, end, totals, sales = [], returns = [], tokensGenerated }){
  const rest = getRestaurantInfo()
  const openTime = new Date(start||Date.now()).toLocaleString('en-PK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const closeTime = new Date(end||Date.now()).toLocaleString('en-PK', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <title>Day Close Summary</title>
    <style>
      @page{size:auto;margin:0}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;background:#fff;color:#000;height:auto !important;min-height:100% !important;overflow:visible !important}
      body{font-family:Arial,sans-serif;padding:16px 16px 80mm 16px;font-weight:400;overflow:visible !important;font-size:14px}
      img,svg{max-width:100%;height:auto}
      .center{text-align:center;page-break-inside:avoid}
      .logo{display:block;margin:0 auto 12px;width:48mm;max-width:100%;height:auto}
      .header-box{border:2px solid #000;padding:8px;margin:12px 0;text-align:center}
      .header-title{font-size:32px;font-weight:bold;line-height:1.2;margin:0}
      .section-title{font-size:16px;font-weight:bold;margin:16px 0 8px 0;text-align:center}
      .field-row{display:flex;align-items:center;margin:8px 0;gap:8px}
      .field-label{min-width:140px;font-weight:normal;font-size:13px}
      .field-value{flex:1;border:1px solid #000;padding:6px 8px;background:#fff;font-weight:bold;font-size:13px}
      .summary-box{border:1px solid #000;padding:12px;margin:16px 0}
      .summary-row{display:flex;justify-content:space-between;margin:6px 0;font-size:14px}
      .summary-label{font-weight:normal}
      .summary-value{font-weight:bold}
      .tail{height:80mm}
      body::after{content:"";display:block;height:100mm}
      @media print{html,body{width:80mm;padding-bottom:80mm}}
    </style></head>
    <body>
      ${rest.logo ? `<img class="logo" src="${rest.logo}" alt="Logo" />` : ''}
      <div class="center" style="font-size:11px;margin-bottom:4px">🗓️ Closed Today Shift</div>
      
      <div class="header-box">
        <div class="header-title">Sale<br>Report</div>
      </div>

      <div class="summary-box">
        <div class="summary-row">
          <span class="summary-label">Shift Date:</span>
          <span class="summary-value">${esc(closeBizDate||bizId)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Total Sale:</span>
          <span class="summary-value">${Number(totals?.gross||0).toFixed(2)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Total<br>Refund:</span>
          <span class="summary-value">${Number(totals?.returned||0).toFixed(2)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Total<br>Transaction:</span>
          <span class="summary-value">${tokensGenerated}</span>
        </div>
        <div class="summary-row" style="border-top:1px solid #000;padding-top:6px;margin-top:6px">
          <span class="summary-label">Net Sale</span>
          <span class="summary-value">${Number(totals?.net||0).toFixed(2)}</span>
        </div>
      </div>

      <div class="section-title">Closed Today Sale</div>

      <div class="field-row">
        <div class="field-label">Closing<br>Date</div>
        <div class="field-value">${esc(closeBizDate||bizId)}</div>
      </div>

      <div class="field-row">
        <div class="field-label">Today Sale</div>
        <div class="field-value">${Number(totals?.gross||0).toFixed(2)}</div>
      </div>

      <div class="field-row">
        <div class="field-label">Today<br>Refund</div>
        <div class="field-value">${Number(totals?.returned||0).toFixed(2)}</div>
      </div>

      <div class="field-row">
        <div class="field-label">Notes</div>
        <div class="field-value"></div>
      </div>

      <div class="field-row">
        <div class="field-label">Shift<br>Status</div>
        <div class="field-value">Closed</div>
      </div>

      <div class="field-row">
        <div class="field-label">Closed By</div>
        <div class="field-value">admin</div>
      </div>

      <div class="field-row">
        <div class="field-label">Closing<br>Time</div>
        <div class="field-value">${esc(closeTime)}</div>
      </div>

      <div class="field-row">
        <div class="field-label">Closed Sale<br>Password</div>
        <div class="field-value">***</div>
      </div>

      <div class="field-row">
        <div class="field-label">Re-Type<br>Password</div>
        <div class="field-value">***</div>
      </div>

      <div class="center" style="margin-top:20px;font-size:13px;font-weight:bold">Closed Today Sale</div>
      
      <div class="tail"></div>
    </body></html>`
}

function buildSaleReceiptHtml(rec, bizIdParam){
  const bizId = bizIdParam || (()=>{ try { return rec?.bizId || getActiveBusinessDateId() } catch { return '' } })()
  const rest = getRestaurantInfo()
  
  // Use the same SVG-based approach as silent printing for consistency
  const lines = (rec.items||[]).map(i => ({ name: `${i.qty} x ${i.name}` , price: (i.price*i.qty).toFixed(2) }))
  const rows = []
  const addRow = (left, right, opts={}) => { 
    rows.push({ 
      left: String(left||'').replace(/[<>]/g,''), 
      right: right!=null?String(right):'', 
      bold: !!opts.bold, 
      size: opts.size||13, 
      gap: opts.gap||18 
    }) 
  }
  
  // Header
  addRow(rest.name || 'Restaurant', '', { bold: true, size: 18, gap: 22 })
  if (rest.address) addRow(rest.address, '')
  if (rest.phone) addRow(rest.phone, '')
  addRow(`Business Date: ${bizId}`, '')
  addRow('','',{gap:10})
  
  // Meta
  addRow('Customer', (rec.customerName || '-'))
  addRow('Token', (rec.token || '-'))
  addRow('Order Type', (rec.orderType || '-'))
  addRow('','',{gap:10})
  
  // Items
  for (const l of lines) addRow(l.name, `Rs.${l.price}`)
  addRow('','',{gap:10})
  
  // Totals
  addRow('Subtotal', `Rs.${Number(rec.subtotal || 0).toFixed(2)}`)
  if (rec.delivery > 0) addRow('Delivery', `Rs.${Number(rec.delivery || 0).toFixed(2)}`)
  addRow('Total', `Rs.${Number(rec.total || 0).toFixed(2)}`, { bold: true })
  addRow('','',{gap:14})
  addRow('Thank you!','',{size:14})
  addRow('Software developed by AlienMatrix','',{size:10})
  
  // Layout
  const width = 520
  const leftPad = 16
  const rightPad = 20
  const rightX = width - rightPad
  let y = 18
  const svgLines = rows.map((r, idx) => {
    y += (idx===0?0:r.gap)
    const weight = 'font-weight="700"'
    if (idx < 4 || idx >= rows.length - 2) {
      return `<text x="${width/2}" y="${y}" font-size="${r.size}" ${weight} text-anchor="middle">${r.left}</text>`
    }
    const left = `<text x="${leftPad}" y="${y}" font-size="${r.size}" ${weight}>${r.left}</text>`
    const right = r.right ? `<text x="${rightX}" y="${y}" font-size="${r.size}" text-anchor="end" ${weight}>${r.right}</text>` : ''
    return left + right
  }).join('')
  const height = y + 40
  
  // Generate SVG-based HTML for consistent printing
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <title>Receipt</title>
    <style>
      @page { size: 80mm auto; margin: 2mm } 
      html,body{margin:0;padding:0 8px;background:#fff} 
      img{display:block;margin:8px auto 4px;max-height:140px;max-width:100%;object-fit:contain;}
    </style>
    </head>
    <body style="margin:0;padding:0 8px;background:#fff;color:#000">
      ${rest.logo ? `<img src="${rest.logo}" alt="Logo" />` : ''}
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <rect width="100%" height="100%" fill="white"/>
        <g font-family="Arial, sans-serif" fill="#000" font-weight="700" style="text-rendering:optimizeSpeed;shape-rendering:crispEdges">${svgLines}</g>
      </svg>
    </body></html>`
}

// Local reprint that shows modal (used by button)
function reprintLocal(rec, currentBizId){
  const html = buildSaleReceiptHtml(rec, currentBizId)
  try { window.__setDayCloseReceipt?.(html) } catch {}
}

// Print day close summary with dialog - user selects printer
async function printReceiptIframe(){
  if (!window.__dayCloseReceiptHtml) return
  const receiptHtml = window.__dayCloseReceiptHtml
  try {
    const cfg = (typeof getPrinterConfig === 'function') ? getPrinterConfig() : null
    if (cfg && cfg.enabled && cfg.printerName && window.burgerPos && window.burgerPos.printSilentToPrinter) {
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(receiptHtml)
      let result = await Promise.race([
        window.burgerPos.printSilentToPrinter(dataUrl, cfg.printerName),
        new Promise(resolve => setTimeout(() => resolve({ success:false, error:'Timeout' }), 8000)),
      ])
      if (!(result && result.success)) {
        result = await Promise.race([
          window.burgerPos.printSilentToPrinter(receiptHtml, cfg.printerName),
          new Promise(resolve => setTimeout(() => resolve({ success:false, error:'Timeout2' }), 8000)),
        ])
      }
      if (result && result.success) { return }
    }
  } catch {}

  console.log('=== PRINT DAY CLOSE SUMMARY START ===')
  console.log('Opening print dialog for user to select printer...')
  
  try {
    // Check if print API is available
    if (!(window.burgerPos && window.burgerPos.printWithDialog)) {
      console.log('Print dialog API not available, falling back to window.print()')
      
      // Create a new window with the receipt content
      const printWindow = window.open('', '_blank', 'width=600,height=800')
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
      
      return
    }

    // Use Electron's print dialog
    console.log('Using Electron print dialog...')
    const result = await window.burgerPos.printWithDialog(receiptHtml)
    
    if (result && result.success) {
      console.log('✅ Print dialog completed successfully')
    } else {
      console.log('Print dialog was cancelled or failed')
    }
    
  } catch (error) {
    console.error('Print error:', error)
    alert(`Print error: ${error.message}`)
  } finally {
    console.log('=== PRINT DAY CLOSE SUMMARY END ===')
  }
}

async function ensureHtml2Pdf(){
  if (window.html2pdf) return true
  return await new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.9.3/dist/html2pdf.bundle.min.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
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

async function downloadReceiptPdf(bizId){
  if (!window.__dayCloseReceiptHtml) return
  const receiptHtml = window.__dayCloseReceiptHtml
  const filename = `DayClose_${bizId||''}.pdf`
  try {
    const ok = await ensureHtml2Pdf()
    if (ok) {
      // Render into a hidden iframe so embedded styles apply correctly
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.left = '-10000px'
      iframe.style.top = '0'
      iframe.style.width = '210mm'
      iframe.style.height = '297mm'
      iframe.style.opacity = '0'
      document.body.appendChild(iframe)
      const idoc = iframe.contentWindow.document
      idoc.open(); idoc.write(receiptHtml); idoc.close()
      // wait a moment and ensure images are decoded
      await new Promise(r => setTimeout(r, 300))
      try {
        const imgs = Array.from(idoc.images||[])
        await Promise.all(imgs.map(img => img.decode ? img.decode().catch(()=>{}) : new Promise(res => { if (img.complete) res(); else { img.onload = img.onerror = () => res() } })))
      } catch {}
      try {
        await window.html2pdf().set({
          margin: [5,5,5,5],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: [80, 297], orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] }
        }).from(idoc.body).save()
        return
      } finally {
        document.body.removeChild(iframe)
      }
    }
  } catch {}

  // Fallback: generate a professional PDF via jsPDF
  try {
    await ensureJsPdfLoaded()
    const { jsPDF } = window.jspdf
    const doc = new jsPDF({ unit:'pt', format:'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 40
    let y = margin

    // Extract key fields by parsing the HTML string
    const parser = new DOMParser()
    const docHtml = parser.parseFromString(receiptHtml, 'text/html')
    const titleEl = docHtml.querySelector('.center.title')
    const titleText = (titleEl?.textContent || '').trim()
    const restName = titleText.replace(/\s+-\s*Day Close Summary$/i, '') || 'Restaurant'
    const rowMap = {}
    docHtml.querySelectorAll('.row').forEach(row => {
      const cells = row.querySelectorAll('div')
      if (cells.length >= 2) {
        const key = (cells[0].textContent || '').trim()
        const val = (cells[1].textContent || '').trim()
        rowMap[key] = val
      }
    })
    
    // Get Day Open and Day Close sections
    const dayOpenBizDate = rowMap['Business Date'] || bizId || ''
    const dayOpenTime = rowMap['Time'] || ''
    const dayCloseBizDate = rowMap['Business Date'] || bizId || ''
    const dayCloseTime = rowMap['Time'] || ''
    const gross = rowMap['Total Sales (Gross)'] || ''
    const returned = rowMap['Refunded (Loss)'] || ''
    const net = rowMap['Net After Refunds'] || ''
    const refunds = rowMap['Refunds'] || ''
    const tokens = rowMap['Tokens Generated'] || ''

    // Header with colored background
    doc.setFillColor(41, 128, 185) // Professional blue
    doc.rect(0, 0, pageWidth, 80, 'F')
    
    // Restaurant name in white
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    try { doc.setFont('helvetica', 'bold') } catch {}
    doc.text(restName, pageWidth/2, 35, { align:'center' })
    
    doc.setFontSize(14)
    try { doc.setFont('helvetica', 'normal') } catch {}
    doc.text('Day Close Summary', pageWidth/2, 60, { align:'center' })
    
    // Reset text color
    doc.setTextColor(0, 0, 0)
    y = 110

    // Day Open Section with background
    doc.setFillColor(236, 240, 241) // Light gray
    doc.roundedRect(margin, y, pageWidth - 2*margin, 70, 5, 5, 'F')
    
    y += 20
    doc.setFontSize(14)
    try { doc.setFont('helvetica', 'bold') } catch {}
    doc.setTextColor(52, 73, 94) // Dark blue-gray
    doc.text('Day Open', margin + 15, y)
    
    y += 20
    doc.setFontSize(11)
    try { doc.setFont('helvetica', 'normal') } catch {}
    doc.setTextColor(0, 0, 0)
    doc.text(`Business Date: ${dayOpenBizDate}`, margin + 15, y)
    y += 18
    doc.text(`Time: ${dayOpenTime}`, margin + 15, y)
    
    y += 30

    // Day Close Section with background
    doc.setFillColor(236, 240, 241)
    doc.roundedRect(margin, y, pageWidth - 2*margin, 70, 5, 5, 'F')
    
    y += 20
    doc.setFontSize(14)
    try { doc.setFont('helvetica', 'bold') } catch {}
    doc.setTextColor(52, 73, 94)
    doc.text('Day Close', margin + 15, y)
    
    y += 20
    doc.setFontSize(11)
    try { doc.setFont('helvetica', 'normal') } catch {}
    doc.setTextColor(0, 0, 0)
    doc.text(`Business Date: ${dayCloseBizDate}`, margin + 15, y)
    y += 18
    doc.text(`Time: ${dayCloseTime}`, margin + 15, y)
    
    y += 40

    // Financial Summary with colored box
    doc.setFillColor(46, 204, 113) // Green for money
    doc.roundedRect(margin, y, pageWidth - 2*margin, 140, 5, 5, 'F')
    
    y += 25
    doc.setFontSize(16)
    try { doc.setFont('helvetica', 'bold') } catch {}
    doc.setTextColor(255, 255, 255)
    doc.text('Financial Summary', margin + 15, y)
    
    y += 25
    doc.setFontSize(12)
    try { doc.setFont('helvetica', 'normal') } catch {}
    doc.text(`Total Sales (Gross): ${gross}`, margin + 15, y)
    y += 22
    doc.text(`Refunded (Loss): ${returned}`, margin + 15, y)
    y += 22
    doc.setFontSize(13)
    try { doc.setFont('helvetica', 'bold') } catch {}
    doc.text(`Net After Refunds: ${net}`, margin + 15, y)
    
    y += 40
    
    // Additional Info
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(11)
    try { doc.setFont('helvetica', 'normal') } catch {}
    doc.text(`Refunds: ${refunds}`, margin + 15, y)
    y += 20
    doc.text(`Tokens Generated: ${tokens}`, margin + 15, y)
    
    // Footer
    y = pageHeight - 40
    doc.setFontSize(9)
    doc.setTextColor(127, 140, 141)
    doc.text('Generated by Oaklyn POS System', pageWidth/2, y, { align:'center' })
    doc.text(new Date().toLocaleString('en-PK'), pageWidth/2, y + 15, { align:'center' })

    doc.save(filename)
  } catch (e) {
    try { alert('PDF download failed.') } catch {}
  }
}

function DateWiseSalesTable({ sales, returns }){
  // Group by business date id based on each record's timestamp
  const rows = useMemo(()=>{
    const map = new Map()
    for (const s of (sales||[])){
      const key = (s?.bizId || getBusinessDateId(s.createdAt||0))
      if (!map.has(key)) map.set(key, { date:key, salesCount:0, returnsCount:0, gross:0, discount:0, returned:0, net:0 })
      const row = map.get(key)
      row.salesCount += 1
      row.gross += (Number(s.subtotal)||0) + (Number(s.delivery)||0)
      row.discount += (Number(s.discountAmount)||0)
    }
    for (const r of (returns||[])){
      const key = (r?.bizId || getBusinessDateId(r.createdAt||0))
      if (!map.has(key)) map.set(key, { date:key, salesCount:0, returnsCount:0, gross:0, discount:0, returned:0, net:0 })
      const row = map.get(key)
      row.returnsCount += 1
      row.returned += (Number(r.total)||0)
    }
    // finalize net
    for (const row of map.values()){
      row.net = Math.max(0, (row.gross - row.discount) - row.returned)
    }
    return Array.from(map.values()).sort((a,b)=> a.date < b.date ? 1 : -1)
  }, [sales, returns])

  // Date filter state: default to active business date
  const [selectedDate, setSelectedDate] = useState(() => { try { return getActiveBusinessDateId() } catch { return '' } })
  const filteredRows = useMemo(() => {
    if (!selectedDate) return rows
    return rows.filter(r => r.date === selectedDate)
  }, [rows, selectedDate])

  return (
    <div className="card" style={{marginTop:12}}>
      <div className="row" style={{justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8}}>
        <div className="card-title">Sales Summary (All Days)</div>
        <div className="row" style={{gap:8, alignItems:'center'}}>
          <label className="muted">Date</label>
          <input className="input" type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)} />
          <button type="button" className="btn" onClick={()=>setSelectedDate('')}>Clear</button>
        </div>
      </div>
      <div className="bill-head" style={{gridTemplateColumns:'140px 100px 100px 140px 140px 140px 160px'}}>
        <div>Date</div>
        <div>Sales</div>
        <div>Returns</div>
        <div>Gross</div>
        <div>Discount</div>
        <div>Returned</div>
        <div>Net</div>
      </div>
      {filteredRows.length===0 && <div className="muted">No sales recorded yet.</div>}
      {filteredRows.map((r)=> (
        <div key={r.date} className="bill-row" style={{gridTemplateColumns:'140px 100px 100px 140px 140px 140px 160px'}}>
          <div>{r.date}</div>
          <div>{r.salesCount}</div>
          <div>{r.returnsCount}</div>
          <div className="price">Rs.{r.gross.toFixed(2)}</div>
          <div className="price">Rs.{r.discount.toFixed(2)}</div>
          <div className="price">Rs.{r.returned.toFixed(2)}</div>
          <div className="price">Rs.{r.net.toFixed(2)}</div>
        </div>
      ))}
    </div>
  )
}
