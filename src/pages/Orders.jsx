import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDialog } from '../components/ConfirmProvider.jsx'
import AdminAuthModal from '../components/AdminAuthModal.jsx'
import { listSales, listReturns, getRestaurantInfo, getActiveBusinessDateId, getBusinessDateId, getPrinterConfig, getCurrentUser, addReturn } from '../utils/storage.js'
import { useModalScrollLock } from '../hooks/useModalScrollLock.js'

function formatMoney(n) {
  const v = isNaN(n) ? 0 : n
  return `Rs.${v.toFixed(0)}`
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function Orders() {
  const navigate = useNavigate()
  const dialog = useDialog()
  const currentUser = getCurrentUser()

  const [sales, setSales] = useState([])
  const [returns, setReturns] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('latest')
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [receiptHtml, setReceiptHtml] = useState('')
  const [reprintAuth, setReprintAuth] = useState(null) // null | rec object pending auth

  useModalScrollLock(receiptOpen || !!reprintAuth)

  useEffect(() => {
    const load = async () => {
      try { setSales(await listSales()) } catch {}
      try { setReturns(await listReturns()) } catch {}
    }
    load()

    window.addEventListener('data:sales-changed', load)
    window.addEventListener('data:returns-changed', load)
    window.addEventListener('storage', load)

    return () => {
      window.removeEventListener('data:sales-changed', load)
      window.removeEventListener('data:returns-changed', load)
      window.removeEventListener('storage', load)
    }
  }, [])

  const returnedIds = useMemo(() => new Set(returns.map(r => String(r.referenceSaleId || ''))), [returns])

  const filteredOrders = useMemo(() => {
    let filtered = [...sales].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(s =>
        String(s.token || '').toLowerCase().includes(q) ||
        (s.customerName || '').toLowerCase().includes(q) ||
        (s.customerNumber || '').toLowerCase().includes(q)
      )
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => {
        if (filterStatus === 'in-progress') return s.orderType === 'dine-in' && !returnedIds.has(String(s.id || s._id || ''))
        if (filterStatus === 'ready') return s.orderType === 'take-away' && !returnedIds.has(String(s.id || s._id || ''))
        if (filterStatus === 'completed') return !returnedIds.has(String(s.id || s._id || ''))
        if (filterStatus === 'refunded') return returnedIds.has(String(s.id || s._id || ''))
        return true
      })
    }

    // Sort
    if (sortBy === 'oldest') {
      filtered = filtered.reverse()
    }

    return filtered
  }, [sales, searchQuery, filterStatus, sortBy, returnedIds])

  const orderStats = useMemo(() => {
    const all = sales.length
    const inProgress = sales.filter(s => s.orderType === 'dine-in' && !returnedIds.has(String(s.id || s._id))).length
    const ready = sales.filter(s => s.orderType === 'take-away' && !returnedIds.has(String(s.id || s._id))).length
    const completed = sales.filter(s => !returnedIds.has(String(s.id || s._id))).length
    const refunded = sales.filter(s => returnedIds.has(String(s.id || s._id))).length
    return { all, inProgress, ready, completed, refunded }
  }, [sales, returnedIds])

  const alreadyReturned = (saleId) => returnedIds.has(String(saleId))

  const doReturn = async (rec) => {
    if (alreadyReturned(String(rec.id || rec._id))) return

    const confirmed = await dialog.confirm({
      title: 'Confirm Refund',
      description: `Are you sure you want to refund this order? Token: ${String(rec.token || '-')}`,
      confirmText: 'Confirm Refund',
      cancelText: 'Cancel'
    })
    if (!confirmed) return

    const ret = await addReturn({
      referenceSaleId: String(rec.id || rec._id),
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
    setReturns(prev => [...prev, ret])
    await dialog.alert({ title: 'Refund Recorded', description: 'Refund recorded for token ' + String(rec.token) })
  }

  const reprint = (rec) => {
    const bizId = rec?.bizId || getActiveBusinessDateId()
    const rest = getRestaurantInfo()

    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const items = (rec.items || []).map(i => ({ name: `${i.qty} x ${i.name}`, price: (i.price * i.qty).toFixed(2) }))
    const dt = new Date(rec.createdAt || Date.now()).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    const itemsHtml = items.map(l => `<div class="row"><div>${esc(l.name)}</div><div>Rs.${l.price}</div></div>`).join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <title>Receipt</title>
      <style>@page{size:auto;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;height:auto !important;overflow:visible !important}body{font-family:ui-monospace,Menlo,Consolas,monospace;padding:8px 8px 50mm 8px;font-weight:700;overflow:visible !important}img,svg{max-width:100%;height:auto}.center{text-align:center;font-weight:700;page-break-inside:avoid}.small{font-size:14px;line-height:1.35}.row{display:flex;justify-content:space-between;gap:8px;page-break-inside:avoid}.sep{border-top:1px dashed #000;margin:8px 0}.logo{display:block;margin:0 auto 6px;width:48mm;max-width:100%;height:auto}.tail{height:50mm}body::after{content:"";display:block;height:80mm}@media print{html,body{width:80mm;padding-bottom:50mm}}</style></head>
      <body>
        ${rest.logo ? `<img class="logo" src="${rest.logo}" alt="Logo" />` : ''}
        <div class="center" style="font-weight:900">${esc(rest.name || 'Restaurant')}</div>
        ${rest.address ? `<div class="center small" style="font-weight:900">${esc(rest.address)}</div>` : ''}
        ${rest.phone ? `<div class="center small" style="font-weight:900">${esc(rest.phone)}</div>` : ''}
        <div class="center small" style="font-weight:900">Business Date: ${esc(bizId)}</div>
        <div class="sep"></div>
        <div class="row"><div style="font-weight:bold">Customer</div><div style="font-weight:bold">${esc(rec.customerName || '-')}</div></div>
        <div class="row"><div style="font-weight:bold">Token</div><div style="font-weight:bold">${esc(rec.token || '-')}</div></div>
        <div class="row"><div style="font-weight:bold">Order Type</div><div style="font-weight:bold">${esc(rec.orderType || '-')}</div></div>
        <div class="row"><div style="font-weight:bold">Date & Time</div><div style="font-weight:bold">${esc(dt)}</div></div>
        ${rec.cashier ? `<div class="row"><div style="font-weight:bold">Cashier</div><div style="font-weight:bold">${esc(rec.cashier)}</div></div>` : ''}
        <div class="sep"></div>
        ${itemsHtml}
        <div class="sep"></div>
        <div class="row"><div style="font-weight:bold">Subtotal</div><div style="font-weight:bold">Rs.${Number(rec.subtotal || 0).toFixed(2)}</div></div>
        ${Number(rec.deliveryCharges || rec.delivery || 0) > 0 ? `<div class="row"><div style="font-weight:bold">Delivery Charges</div><div style="font-weight:bold">Rs.${Number(rec.deliveryCharges || rec.delivery || 0).toFixed(2)}</div></div>` : ''}
        <div class="row"><div style="font-weight:bold"><b>Total</b></div><div style="font-weight:bold"><b>Rs.${Number(rec.total || 0).toFixed(2)}</b></div></div>
        <div class="sep"></div>
        <div class="center small" style="font-weight:900">Thank you!</div>
        <div class="center small" style="font-weight:900">Software by AlienMatrix</div>
        <div class="tail"></div>
      </body></html>`
    setReceiptHtml(html)
    setReceiptOpen(true)
  }

  const printReceipt = async () => {
    if (!receiptHtml) return
    try {
      if (window.burgerPos && window.burgerPos.printWithDialog) {
        const result = await window.burgerPos.printWithDialog(receiptHtml)
        if (result?.success) setReceiptOpen(false)
      } else {
        const printWindow = window.open('', '_blank', 'width=400,height=600')
        if (!printWindow) {
          alert('Pop-up blocked! Please allow pop-ups for this site.')
          return
        }
        printWindow.document.write(receiptHtml)
        printWindow.document.close()
        setTimeout(() => {
          printWindow.focus()
          printWindow.print()
          setTimeout(() => printWindow.close(), 3000)
        }, 500)
        setReceiptOpen(false)
      }
    } catch (error) {
      alert(`Print error: ${error.message}`)
    }
  }

  const getStatusBadge = (order) => {
    if (alreadyReturned(String(order.id))) {
      return { class: 'refunded', label: 'Refunded', icon: '↩' }
    }
    if (order.orderType === 'dine-in') {
      return { class: 'in-progress', label: 'In Progress', icon: '⏱' }
    }
    if (order.orderType === 'take-away') {
      return { class: 'waiting', label: 'Waiting for Payment', icon: '⏳' }
    }
    return { class: 'completed', label: 'Completed', icon: '✓' }
  }

  return (
    <section className="page orders-page">
      {/* Header */}
      <div className="orders-header">
        <div className="orders-title-section">
          <h1>Orders</h1>
          <p className="muted">Manage and track all customer orders</p>
        </div>
        <div className="orders-actions">
          <button className="btn-create" onClick={() => navigate('/pos')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create New Order
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="orders-tabs">
        <button className={`tab-btn ${filterStatus === 'all' ? 'active' : ''}`} onClick={() => setFilterStatus('all')}>
          All <span className="tab-count">{orderStats.all}</span>
        </button>
        <button className={`tab-btn ${filterStatus === 'in-progress' ? 'active' : ''}`} onClick={() => setFilterStatus('in-progress')}>
          In Progress <span className="tab-count">{orderStats.inProgress}</span>
        </button>
        <button className={`tab-btn ${filterStatus === 'ready' ? 'active' : ''}`} onClick={() => setFilterStatus('ready')}>
          Ready to Serve <span className="tab-count">{orderStats.ready}</span>
        </button>
        <button className={`tab-btn ${filterStatus === 'completed' ? 'active' : ''}`} onClick={() => setFilterStatus('completed')}>
          Completed <span className="tab-count">{orderStats.completed}</span>
        </button>
        <button className={`tab-btn ${filterStatus === 'refunded' ? 'active' : ''}`} onClick={() => setFilterStatus('refunded')}>
          Refunded <span className="tab-count">{orderStats.refunded}</span>
        </button>
      </div>

      {/* Search and Sort */}
      <div className="orders-toolbar">
        <div className="search-box">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search Order ID or Customer Name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="sort-dropdown">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="latest">Sort by: Latest Order</option>
            <option value="oldest">Sort by: Oldest Order</option>
          </select>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="orders-grid">
        {filteredOrders.length === 0 ? (
          <div className="orders-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 2v2M15 2v2M12 2v8M8 12h8M7 17h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" />
            </svg>
            <p>No orders found</p>
            <span>Try adjusting your filters or search query</span>
          </div>
        ) : (
          filteredOrders.map(order => {
            const status = getStatusBadge(order)
            return (
              <div key={String(order.id || order._id || Math.random())} className="order-detail-card">
                <div className="order-detail-header">
                  <div className="order-detail-id">Order# {order.token || 'N/A'}</div>
                  <div className="order-detail-type">{order.orderType === 'dine-in' ? 'Dine In' : order.orderType === 'take-away' ? 'Take Away' : 'Delivery'}</div>
                  <div className="order-detail-date">{formatDate(order.createdAt)}, {formatTime(order.createdAt)}</div>
                </div>

                <div className="order-detail-customer">
                  <div className="customer-avatar-large" style={{ background: `hsl(${(order.token || 0) * 30 % 360}, 70%, 60%)` }}>
                    {(order.customerName || 'G')[0].toUpperCase()}
                  </div>
                  <div className="customer-details">
                    <div className="customer-label">Customer Name</div>
                    <div className="customer-name">{order.customerName || 'Guest'}</div>
                  </div>
                  <div className={`order-status-badge ${status.class}`}>
                    <span>{status.icon}</span>
                    {status.label}
                  </div>
                </div>

                <div className="order-items-table">
                  <div className="items-header">
                    <span>Items</span>
                    <span>Qty</span>
                    <span>Price</span>
                  </div>
                  {(order.items || []).slice(0, 4).map((item, idx) => (
                    <div key={idx} className="item-row">
                      <span className="item-name">{item.name}</span>
                      <span className="item-qty">{item.qty}</span>
                      <span className="item-price">{formatMoney(item.price * item.qty)}</span>
                    </div>
                  ))}
                  {(order.items || []).length > 4 && (
                    <div className="item-more">+{(order.items.length - 4)} more items</div>
                  )}
                </div>

                <div className="order-detail-footer">
                  <div className="order-total-section">
                    <div className="total-row">
                      <span>Total</span>
                      <span className="total-amount">{formatMoney(order.total)}</span>
                    </div>
                  </div>
                  <div className="order-detail-actions">
                    <button className="btn-view" onClick={() => setReprintAuth(order)}>Reprint</button>
                    {!alreadyReturned(String(order.id || order._id)) ? (
                      <button className="btn-pay" onClick={() => doReturn(order)}>Refund</button>
                    ) : (
                      <button className="btn-pay disabled" disabled>Refunded</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Receipt Modal */}
      {receiptOpen && (
        <div className="modal-overlay" onClick={() => setReceiptOpen(false)}>
          <div className="modal modal-receipt" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Receipt Preview</h3>
              <button className="modal-close" onClick={() => setReceiptOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div dangerouslySetInnerHTML={{ __html: receiptHtml }} />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setReceiptOpen(false)}>Close</button>
              <button className="btn-primary" onClick={printReceipt}>Print</button>
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
