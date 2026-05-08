import { useEffect, useMemo, useState } from 'react'
import { useDialog } from '../components/ConfirmProvider.jsx'
import AdminAuthModal from '../components/AdminAuthModal.jsx'
import { listSales, getCurrentUser, getRestaurantInfo, getActiveBusinessDateId, getBusinessDateId, addReturn, listReturns, getPrinterConfig } from '../utils/storage.js'
import { useModalScrollLock } from '../hooks/useModalScrollLock.js'

function formatMoney(n) {
  const v = isNaN(n) ? 0 : n
  return `Rs.${v.toFixed(2)}`
}

export default function RecentSales() {
  const [sales, setSales] = useState([])
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptHtml, setReceiptHtml] = useState('')
  const [existingReturns, setExistingReturns] = useState([])
  const [reprintAuth, setReprintAuth] = useState(null)

  // Manage body scroll when modal is open
  useModalScrollLock(receiptOpen || !!reprintAuth)
  const [selectedDate, setSelectedDate] = useState('') // For date filter
  const [reportOpen, setReportOpen] = useState(false) // For report dialog
  const currentUser = getCurrentUser()
  const restaurantInfo = getRestaurantInfo()
  const dialog = useDialog()

  useEffect(() => {
    const load = async () => { 
      try { setSales(await listSales()) } catch {}
      try { setExistingReturns(await listReturns()) } catch {}
    }
    load()
    // Set default date to active business date
    setSelectedDate(getActiveBusinessDateId())
    
    const onSales = () => load()
    const onReturns = () => load()
    const onDay = () => { setSelectedDate(getActiveBusinessDateId()) }
    window.addEventListener('data:sales-changed', onSales)
    window.addEventListener('data:returns-changed', onReturns)
    window.addEventListener('day:status-changed', onDay)
    window.addEventListener('storage', load)
    
    return () => {
      window.removeEventListener('data:sales-changed', onSales)
      window.removeEventListener('data:returns-changed', onReturns)
      window.removeEventListener('day:status-changed', onDay)
      window.removeEventListener('storage', load)
    }
  }, [])

  // Filter sales by current cashier and selected date
  const mySales = useMemo(() => {
    let filtered = sales
    
    // Filter by selected date if set
    if (selectedDate) {
      filtered = filtered.filter(s => {
        try {
          const saleBizId = s?.bizId || getBusinessDateId(s.createdAt || Date.now())
          return saleBizId === selectedDate
        } catch {
          return false
        }
      })
    }
    
    return filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) // Most recent first
  }, [sales, currentUser, selectedDate])

  // Check if order already returned
  const alreadyReturned = (saleId) => existingReturns.some(r => String(r.referenceSaleId || '') === String(saleId || ''))

  // Handle return order
  const doReturn = async (rec) => {
    if (alreadyReturned(String(rec.id || rec._id || ''))) return
    
    const confirmed = await dialog.confirm({
      title: 'Confirm Refund',
      description: `Are you sure you want to refund this order? Token: ${String(rec.token || '-')}`,
      confirmText: 'Confirm Refund',
      cancelText: 'Cancel'
    })
    if (!confirmed) return
    
    // Add return record
    const ret = await addReturn({
      referenceSaleId: String(rec.id || rec._id || ''),
      token: rec.token,
      customerName: rec.customerName,
      customerNumber: rec.customerNumber,
      orderType: rec.orderType,
      items: rec.items,
      subtotal: rec.subtotal,
      delivery: rec.delivery,
      discountPct: rec.discountPct,
      discountAmount: rec.discountAmount,
      total: rec.total,
    })
    setExistingReturns(prev => [...prev, ret])
    await dialog.alert({ title: 'Refund Recorded', description: 'Refund recorded for token ' + String(rec.token) })
  }

  // Reprint receipt
  const reprint = (rec) => {
    const bizId = (() => { try { return rec?.bizId || getActiveBusinessDateId() } catch { return '' } })()
    const rest = getRestaurantInfo()
    
    const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    const items = (rec.items || []).map(i => ({ name: `${i.qty} x ${i.name}`, price: (i.price * i.qty).toFixed(2) }))
    const dt = new Date(rec.createdAt || Date.now()).toLocaleString('en-GB', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})
    const itemsHtml = items.map(l => `<div class="row"><div>${esc(l.name)}</div><div>Rs.${l.price}</div></div>`).join('')
    const receiptHtml = `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <title>Receipt</title>
      <style>@page{size:auto;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;height:auto !important;overflow:visible !important}body{font-family:ui-monospace,Menlo,Consolas,monospace;padding:8px 8px 50mm 8px;font-weight:700;overflow:visible !important}img,svg{max-width:100%;height:auto}.center{text-align:center;font-weight:700;page-break-inside:avoid}.small{font-size:14px;line-height:1.35}.row{display:flex;justify-content:space-between;gap:8px;page-break-inside:avoid}.sep{border-top:1px dashed #000;margin:8px 0}.logo{display:block;margin:0 auto 6px;width:48mm;max-width:100%;height:auto}.tail{height:50mm}body::after{content:"";display:block;height:80mm}@media print{html,body{width:80mm;padding-bottom:50mm}}</style></head>
      <body>
        ${rest.logo ? `<img class="logo" src="${rest.logo}" alt="Logo" />` : ''}
        <div class="center" style="font-weight:900">${esc(rest.name || 'Restaurant')}</div>
        ${rest.address ? `<div class="center small" style="font-weight:900">${esc(rest.address)}</div>` : ''}
        ${rest.phone ? `<div class="center small" style="font-weight:900">${esc(rest.phone)}</div>` : ''}
        <div class="center small" style="font-weight:900">Business Date: ${esc(bizId)}</div>
        <div class="sep"></div>
        <div class="row"><div style="font-weight: bold;">Customer</div><div style="font-weight: bold;">${esc(rec.customerName || '-')}</div></div>
        <div class="row"><div style="font-weight: bold;">Token</div><div style="font-weight: bold;">${esc(rec.token || '-')}</div></div>
        <div class="row"><div style="font-weight: bold;">Order Type</div><div style="font-weight: bold;">${esc(rec.orderType || '-')}</div></div>
        <div class="row"><div style="font-weight: bold;">Date & Time</div><div style="font-weight: bold;">${esc(dt)}</div></div>
        ${rec.cashier ? `<div class=\"row\"><div style="font-weight: bold;">Cashier</div><div style="font-weight: bold;">${esc(rec.cashier)}</div></div>` : ''}
        <div class="sep"></div>
        ${itemsHtml}
        <div class="sep"></div>
        <div class="row"><div style="font-weight: bold;">Subtotal</div><div style="font-weight: bold;">Rs.${Number(rec.subtotal||0).toFixed(2)}</div></div>
        ${Number(rec.deliveryCharges || rec.delivery || 0) > 0 ? `<div class="row"><div style="font-weight: bold;">Delivery Charges</div><div style="font-weight: bold;">Rs.${Number(rec.deliveryCharges || rec.delivery || 0).toFixed(2)}</div></div>` : ''}
        <div class="row"><div style="font-weight: bold;"><b>Total</b></div><div style="font-weight: bold;"><b>Rs.${Number(rec.total||0).toFixed(2)}</b></div></div>
        <div class="sep"></div>
        <div class="center small" style="font-weight:900">Thank you!</div>
        <div class="center small" style="font-weight:900">Software by AlienMatrix</div>
        <div class="tail"></div>
      </body></html>`
    setReceiptHtml(receiptHtml)
    setReceiptOpen(true)
  }

  // Print receipt with dialog - user selects printer
  async function printReceiptIframe() {
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

    console.log('=== PRINT RECENT SALES RECEIPT START ===')
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
      console.log('=== PRINT RECENT SALES RECEIPT END ===')
    }
  }

  // Calculate today's statistics
  const todayStats = useMemo(() => {
    const totalOrders = mySales.length
    const returnedOrders = mySales.filter(sale => alreadyReturned(sale.id)).length
    return { totalOrders, returnedOrders }
  }, [mySales, existingReturns])

  return (
    <>
    <section>
      <h1>Recent Sales</h1>
      <p className="muted">Your sales for the current business day</p>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="card-title">{restaurantInfo?.name || 'Restaurant'}</div>
          </div>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <label className="muted">Date:</label>
            <input 
              className="input" 
              type="date" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ width: 200 }}
            />
            <button className="btn primary" onClick={() => setReportOpen(true)}>Show Report</button>
          </div>
        </div>
      </div>

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

      {reportOpen && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }} onClick={() => setReportOpen(false)}>
          <div className="card" style={{ width: 'min(500px,92vw)', padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Daily Report</h2>
            <p className="muted" style={{ marginBottom: 20 }}>Date: {selectedDate || 'All Time'}</p>
            
            <div style={{ marginBottom: 16 }}>
              <div className="row" style={{ justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Total Orders</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--primary)' }}>{todayStats.totalOrders}</div>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Refunded Orders</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--danger)' }}>{todayStats.returnedOrders}</div>
              </div>
              <div className="row" style={{ justifyContent: 'space-between', padding: '12px 0' }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Successful Orders</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>{todayStats.totalOrders - todayStats.returnedOrders}</div>
              </div>
            </div>

            <div className="actions" style={{ marginTop: 20 }}>
              <button className="btn primary" onClick={() => setReportOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="bill-head" style={{ gridTemplateColumns: '140px 80px 1fr 2fr 120px 100px 180px' }}>
          <div>Time</div>
          <div>Token</div>
          <div>Customer</div>
          <div>Items</div>
          <div>Order Type</div>
          <div>Total</div>
          <div>Actions</div>
        </div>
        {mySales.length === 0 && <div className="muted">No sales yet.</div>}
        {mySales.map(rec => (
          <div key={String(rec.id || rec._id || Math.random())} className="bill-row" style={{ gridTemplateColumns: '140px 80px 1fr 2fr 120px 100px 180px' }}>
            <div>{new Date(rec.createdAt || Date.now()).toLocaleTimeString()}</div>
            <div>{rec.token || '-'}</div>
            <div className="grow">{rec.customerName || '-'}</div>
            <div>{(rec.items || []).map(i => `${i.qty} x ${i.name}`).join(', ') || '-'}</div>
            <div>{rec.orderType || '-'}</div>
            <div className="price">{formatMoney(rec.total)}</div>
            <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
              <button className="btn" style={{ background: '#ff9800', borderColor: '#ff9800', color: '#fff' }} onClick={() => setReprintAuth(rec)}>Reprint</button>
              <button className="btn danger" disabled={alreadyReturned(rec.id)} onClick={() => doReturn(rec)}>{alreadyReturned(rec.id) ? 'Refunded' : 'Refund'}</button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
