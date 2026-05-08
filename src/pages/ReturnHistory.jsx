import { useEffect, useMemo, useRef, useState } from 'react'
import { useConfirm } from '../components/ConfirmProvider.jsx'
import AdminAuthModal from '../components/AdminAuthModal.jsx'
import { listReturns, deleteReturn, getRestaurantInfo, getBusinessDateId, getActiveBusinessDateId, getPrinterConfig } from '../utils/storage.js'
import { useModalScrollLock } from '../hooks/useModalScrollLock.js'

export default function ReturnHistory(){
  const [rows, setRows] = useState([])
  const confirm = useConfirm()
  const [date, setDate] = useState('') // yyyy-mm-dd
  const dateRef = useRef(null)
  // Receipt modal state
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptHtml, setReceiptHtml] = useState('')
  const [reprintAuth, setReprintAuth] = useState(null)

  // Manage body scroll when modal is open
  useModalScrollLock(receiptOpen || !!reprintAuth)

  useEffect(()=>{ 
    const load = async () => { try { setRows(await listReturns()) } catch {} }
    load()
    // Default to active business date
    setDate(getActiveBusinessDateId())
    const syncDate = () => { setDate(getActiveBusinessDateId()) }
    const onReturns = () => load()
    window.addEventListener('data:returns-changed', onReturns)
    window.addEventListener('day:status-changed', syncDate)
    window.addEventListener('storage', load)
    window.addEventListener('storage', syncDate)
    return () => {
      window.removeEventListener('data:returns-changed', onReturns)
      window.removeEventListener('day:status-changed', syncDate)
      window.removeEventListener('storage', load)
      window.removeEventListener('storage', syncDate)
    }
  },[])

  const recBizIdEq = (rec, ymd) => {
    if (!ymd) return true
    try { return (rec?.bizId || getBusinessDateId(rec?.createdAt||Date.now())) === ymd } catch { return false }
  }

  const filteredRows = useMemo(()=> rows.filter(r => recBizIdEq(r, date)), [rows, date])

  const handleDelete = async (id) => {
    const ok = await confirm({ title: 'Delete Refund', description: 'Are you sure you want to delete this?' })
    if (!ok) return
    await deleteReturn(id)
    setRows(prev=>prev.filter(r=>r.id!==id))
  }

  const reprint = (rec) => {
    const bizId = (()=>{ try { return rec?.bizId || getActiveBusinessDateId() } catch { return '' } })()
    const rest = getRestaurantInfo()
    const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    const items = (rec.items||[]).map(i => ({ name: `${i.qty} x ${i.name}` , price: (i.price*i.qty).toFixed(2) }))
    const itemsHtml = items.map(l => `<div class=\"row\"><div>${esc(l.name)}</div><div>Rs.${l.price}</div></div>`).join('')
    const receiptHtml = `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <title>Refund Receipt</title>
    <style>@page{size:auto;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;height:auto !important;min-height:100% !important;overflow:visible !important}body{font-family:ui-monospace,Menlo,Consolas,monospace;padding:8px 8px 50mm 8px;font-weight:700;overflow:visible !important}img,svg{max-width:100%;height:auto}.center{text-align:center;font-weight:700;page-break-inside:avoid}.small{font-size:14px;line-height:1.35}.row{display:flex;justify-content:space-between;gap:8px;page-break-inside:avoid}.sep{border-top:1px dashed #000;margin:8px 0}.logo{display:block;margin:0 auto 6px;width:48mm;max-width:100%;height:auto}.tail{height:50mm}body::after{content:"";display:block;height:80mm}@media print{html,body{width:80mm;padding-bottom:50mm}}</style></head>
    <body>
      ${rest.logo ? `<img class=\"logo\" src=\"${rest.logo}\" alt=\"Logo\" />` : ''}
      <div class=\"center\" style=\"font-weight:900\">${esc((rest.name || 'Restaurant') + ' (REFUND)')}</div>
      ${rest.address ? `<div class=\"center small\" style=\"font-weight:900\">${esc(rest.address)}</div>` : ''}
      ${rest.phone ? `<div class=\"center small\" style=\"font-weight:900\">${esc(rest.phone)}</div>` : ''}
      <div class=\"center small\" style=\"font-weight:900\">Business Date: ${esc(bizId)}</div>
      <div class=\"sep\"></div>
      <div class=\"row\"><div><b>Customer</b></div><div><b>${esc(rec.customerName||'-')}</b></div></div>
      <div class=\"row\"><div><b>Token</b></div><div><b>${esc(rec.token||'-')}</b></div></div>
      <div class=\"row\"><div><b>Order Type</b></div><div><b>${esc(rec.orderType||'-')}</b></div></div>
      ${rec.cashier ? `<div class="row"><div><b>Cashier</b></div><div><b>${esc(rec.cashier)}</b></div></div>` : ''}
      <div class=\"sep\"></div>
      ${itemsHtml}
      <div class=\"sep\"></div>
      <div class=\"row\"><div><b>Subtotal</b></div><div><b>Rs.${Number(rec.subtotal||0).toFixed(2)}</b></div></div>
      ${Number(rec.deliveryCharges || rec.delivery || 0) > 0 ? `<div class="row"><div><b>Delivery Charges</b></div><div><b>Rs.${Number(rec.deliveryCharges || rec.delivery || 0).toFixed(2)}</b></div></div>` : ''}
      <div class=\"row\"><div><b><b>Total Refunded</b></b></div><div><b><b>Rs.${Number(rec.total||0).toFixed(2)}</b></b></div></div>
      <div class=\"sep\"></div>
      <div class=\"center small\" style=\"font-weight:900\">Processed Refund</div>
      <div class=\"center small\" style=\"font-weight:900\">Software developed by AlienMatrix</div>
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

    console.log('=== PRINT REFUND HISTORY RECEIPT START ===')
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
          }, 3000)
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
      console.log('=== PRINT REFUND HISTORY RECEIPT END ===')
    }
  }

  return (
    <section>
      <h1>Refund History</h1>
      <div className="row" style={{marginBottom:12, justifyContent:'space-between'}}>
        <div className="row" style={{gap:8, alignItems:'center'}}>
          <div className="input-wrap" style={{minWidth:220}}>
            <input ref={dateRef} className="input" type="date" value={date} onChange={(e)=>setDate(e.target.value)} />
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
          {date && <button className="btn" onClick={()=>setDate('')}>Clear</button>}
        </div>
        <div className="muted">Count: <b>{filteredRows.length}</b></div>
      </div>
      <div className="card">
        <div className="bill-head" style={{gridTemplateColumns:'140px 80px 1fr 100px 160px'}}>
          <div>Date</div>
          <div>Token</div>
          <div>Customer</div>
          <div>Total</div>
          <div>Actions</div>
        </div>
        {filteredRows.length===0 && <div className="muted">No refunds yet.</div>}
        {filteredRows.map(rec => (
          <div key={String(rec.id || rec._id || Math.random())} className="bill-row" style={{gridTemplateColumns:'140px 80px 1fr 100px 160px'}}>
            <div>{rec?.bizId || getBusinessDateId(rec.createdAt||Date.now())}</div>
            <div>{rec.token||'-'}</div>
            <div className="grow">{rec.customerName||'-'}</div>
            <div className="price">Rs.{Number(rec.total||0).toFixed(2)}</div>
            <div className="row" style={{justifyContent:'flex-start'}}>
              <button className="btn" style={{background:'#ff9800', borderColor:'#ff9800', color:'#fff'}} onClick={()=>setReprintAuth(rec)}>Reprint</button>
              <button className="btn danger" onClick={()=>handleDelete(rec.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
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

      {/* Admin Auth Modal for Reprint */}
      {reprintAuth && (
        <AdminAuthModal
          onVerified={(adminName) => {
            reprint(reprintAuth)
            setReprintAuth(null)
          }}
          onCancel={() => setReprintAuth(null)}
        />
      )}
    </section>
  )
}
