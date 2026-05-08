import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listSales, listReturns, getDayOpenAt, getYesterdaySummary, isTokenClosed, isTokenClosedSync, getActiveBusinessDateId, getBusinessDateId, incrementBusinessDateId, getCurrentUser } from '../utils/storage.js'
import DashboardCalendar from '../components/dashboard/DashboardCalendar.jsx'

function startOfDay(ts){
  const d = new Date(ts); d.setHours(0,0,0,0); return d.getTime()
}
function formatMoney(n){
  const v = isNaN(n) ? 0 : n; return `Rs.${v.toFixed(0)}`
}
function formatTime(ts){
  return new Date(ts).toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})
}
function formatDate(ts){
  return new Date(ts).toLocaleDateString('en-GB', {day:'2-digit', month:'short'})
}

export default function Dashboard() {
  const navigate = useNavigate()
  const currentUser = getCurrentUser()
  const [sales, setSales] = useState([])
  const [returns, setReturns] = useState([])
  const [range, setRange] = useState('today')
  const [dateOnly, setDateOnly] = useState('')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [yesterday, setYesterday] = useState({ bizId: '', subtotal: 0, deliveryCharges: 0, gross: 0, discount: 0, net: 0, returned: 0, salesCount: 0, returnsCount: 0, tokensGenerated: 0 })
  const [currentTime, setCurrentTime] = useState(new Date())
  const dateRef = useRef(null)
  const fromRef = useRef(null)
  const toRef = useRef(null)

  useEffect(()=>{
    const load = async () => {
      try { setSales(await listSales()) } catch {}
      try { setReturns(await listReturns()) } catch {}
      try { setYesterday(await getYesterdaySummary()) } catch {}
    }
    load()
    try { setDateOnly(new Date().toISOString().slice(0,10)) } catch {}

    window.addEventListener('data:sales-changed', load)
    window.addEventListener('data:returns-changed', load)
    window.addEventListener('storage', load)
    window.addEventListener('day:status-changed', load)
    return () => {
      window.removeEventListener('data:sales-changed', load)
      window.removeEventListener('data:returns-changed', load)
      window.removeEventListener('storage', load)
      window.removeEventListener('day:status-changed', load)
    }
  },[])

  // Update time every second
  useEffect(()=>{
    const id = setInterval(()=>setCurrentTime(new Date()), 1000)
    return ()=>clearInterval(id)
  },[])

  // Lightweight polling to reflect Day Close/Open changes
  useEffect(()=>{
    const id = setInterval(()=>{
      getYesterdaySummary().then(v => setYesterday(v)).catch(()=>{})
    }, 2000)
    return () => clearInterval(id)
  },[])

  // Date range calculation
  const { from, to } = useMemo(()=>{
    const now = new Date()
    const todayStart = startOfDay(now)
    const oneDay = 24*60*60*1000
    switch(range){
      case 'today': return { from: todayStart, to: todayStart + oneDay - 1 }
      case 'yesterday': return { from: todayStart - oneDay, to: todayStart - 1 }
      case 'date': {
        if (!dateOnly) return { from: todayStart, to: todayStart + oneDay - 1 }
        const d = new Date(dateOnly + 'T00:00:00')
        const s = d.getTime(); return { from: s, to: s + oneDay - 1 }
      }
      case 'last7': return { from: todayStart - 6*oneDay, to: todayStart + oneDay - 1 }
      case 'month': {
        const d = new Date(now.getFullYear(), now.getMonth(), 1)
        return { from: d.getTime(), to: todayStart + oneDay - 1 }
      }
      case 'custom': {
        const f = customFrom ? new Date(customFrom + 'T00:00:00').getTime() : 0
        const t = customTo ? new Date(customTo + 'T23:59:59').getTime() : Date.now()
        return { from: f, to: t }
      }
      default: return { from: 0, to: Date.now() }
    }
  },[range, dateOnly, customFrom, customTo])

  // Apply business Open Day floor: hide data before opening time if set
  const openedAt = 0
  const effectiveFrom = Math.max(from, openedAt || 0)

  // Build selected Business Date range [bizFromId, bizToId]
  const { bizFromId, bizToId } = useMemo(()=>{
    const activeBiz = getActiveBusinessDateId()
    const oneDay = 24*60*60*1000
    switch(range){
      case 'today': {
        return { bizFromId: activeBiz, bizToId: activeBiz }
      }
      case 'yesterday': {
        const y = incrementBusinessDateId(activeBiz, -1)
        return { bizFromId: y, bizToId: y }
      }
      case 'date': {
        if (!dateOnly) return { bizFromId: activeBiz, bizToId: activeBiz }
        // Convert the picked calendar date to its business date id
        const s = new Date(dateOnly + 'T00:00:00').getTime()
        const id = getBusinessDateId(s)
        return { bizFromId: id, bizToId: id }
      }
      case 'last7': {
        const fromId = incrementBusinessDateId(activeBiz, -6)
        return { bizFromId: fromId, bizToId: activeBiz }
      }
      case 'month': {
        const now = new Date()
        const first = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
        const fromId = getBusinessDateId(first)
        return { bizFromId: fromId, bizToId: activeBiz }
      }
      case 'custom': {
        const fromId = customFrom ? getBusinessDateId(new Date(customFrom + 'T00:00:00').getTime()) : '0000-01-01'
        const toId = customTo ? getBusinessDateId(new Date(customTo + 'T23:59:59').getTime()) : activeBiz
        return { bizFromId: fromId, bizToId: toId }
      }
      default: {
        // all time
        return { bizFromId: '0000-01-01', bizToId: '9999-12-31' }
      }
    }
  },[range, dateOnly, customFrom, customTo])

  // Filtered sales & returns by Business Date IDs
  const filteredSales = useMemo(()=> sales.filter(s => {
    const id = (s?.bizId) || getBusinessDateId(s?.createdAt||0)
    return id >= bizFromId && id <= bizToId
  }), [sales, bizFromId, bizToId])
  const filteredReturns = useMemo(()=> returns.filter(r => {
    const id = (r?.bizId) || getBusinessDateId(r?.createdAt||0)
    return id >= bizFromId && id <= bizToId
  }), [returns, bizFromId, bizToId])

  // For "Today" KPIs, use business-date equality (same logic as Sale History) to avoid time-range mismatches
  const filteredSalesBizToday = useMemo(()=>{
    const bizId = getActiveBusinessDateId()
    return sales.filter(s => (s?.bizId || getBusinessDateId(s?.createdAt||0)) === bizId)
  },[sales])
  const filteredReturnsBizToday = useMemo(()=>{
    const bizId = getActiveBusinessDateId()
    return returns.filter(r => (r?.bizId || getBusinessDateId(r?.createdAt||0)) === bizId)
  },[returns])

  // KPIs for Today (live). If day is closed, show zeros to indicate reset until re-open.
  const kpisToday = useMemo(()=>{
    const closed = isTokenClosedSync()
    if (closed) return { subtotal: 0, deliveryCharges: 0, gross: 0, discount: 0, returned: 0, netAfterReturns: 0, returnsCount: 0, tokensGenerated: 0 }
    const salesSrc = filteredSalesBizToday
    const returnsSrc = filteredReturnsBizToday
    const subtotal = salesSrc.reduce((sum, s) => sum + (Number(s.subtotal)||0), 0)
    const deliveryCharges = salesSrc.reduce((sum, s) => sum + (Number(s.deliveryCharges)||0), 0)
    const gross = subtotal + deliveryCharges
    const discount = salesSrc.reduce((sum, s) => sum + (Number((s.discount ?? s.discountAmount) || 0)||0), 0)
    const returned = returnsSrc.reduce((sum, r) => sum + (Number(r.total)||0), 0)
    const netAfterReturns = Math.max(0, gross - discount - returned)
    const returnsCount = returnsSrc.length
    const tokensGenerated = salesSrc.length
    return { subtotal, deliveryCharges, gross, discount, returned, netAfterReturns, returnsCount, tokensGenerated }
  },[filteredSalesBizToday, filteredReturnsBizToday])

  // Build daily series for multi-day chart
  const series = useMemo(()=>{
    // Group by Business Date ID (YYYY-MM-DD)
    const map = new Map()
    filteredSales.forEach(s => {
      const key = (s?.bizId) || getBusinessDateId(s?.createdAt||0)
      const prev = map.get(key) || 0
      map.set(key, prev + (Number(s.total)||0))
    })
    // Sort by bizId
    return Array.from(map.entries()).sort((a,b)=>a[0] < b[0] ? -1 : 1)
  },[filteredSales])

  const maxVal = Math.max(1, ...series.map(([,v])=>v))

  // Removed monthly calendar heatmaps (tokens/returns) per request

  // Calculate order statuses for summary cards
  const orderStats = useMemo(()=>{
    const bizId = getActiveBusinessDateId()
    const todaySales = sales.filter(s => (s?.bizId || getBusinessDateId(s?.createdAt||0)) === bizId)
    const returnedIds = new Set(returns.map(r => String(r.referenceSaleId || '')))
    
    const totalEarning = todaySales.reduce((sum, s) => sum + (Number(s.total)||0), 0)
    const inProgress = todaySales.filter(s => !returnedIds.has(String(s.id || s._id || '')) && s.orderType === 'dine-in').length
    const readyToServe = todaySales.filter(s => !returnedIds.has(String(s.id || s._id || '')) && s.orderType === 'take-away').length
    const completed = todaySales.filter(s => !returnedIds.has(String(s.id || s._id || ''))).length
    
    return { totalEarning, inProgress, readyToServe, completed, totalOrders: todaySales.length }
  }, [sales, returns])

  // Recent orders for display
  const recentOrders = useMemo(()=>{
    const bizId = getActiveBusinessDateId()
    return sales
      .filter(s => (s?.bizId || getBusinessDateId(s?.createdAt||0)) === bizId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 6)
  }, [sales])

  const greeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  return (
    <section className="page dashboard-page">
      {/* Header Section */}
      <div className="dashboard-header">
        <div className="dashboard-greeting">
          <h1>{greeting()}, {currentUser?.username || 'Admin'}</h1>
          <p className="muted">Give your best services for customers, happy working</p>
        </div>
        <div className="dashboard-time">
          <div className="time-display">{currentTime.toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit', second:'2-digit'})}</div>
          <div className="date-display">{currentTime.toLocaleDateString('en-GB', {weekday:'long', day:'numeric', month:'long', year:'numeric'})}</div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="dashboard-stats">
        <div className="stat-card primary">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-label">Total Earning</div>
            <div className="stat-value">{formatMoney(orderStats.totalEarning)}</div>
          </div>
        </div>
        <div className="stat-card blue">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-label">In Progress</div>
            <div className="stat-value">{orderStats.inProgress}</div>
          </div>
        </div>
        <div className="stat-card green">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-label">Ready to Serve</div>
            <div className="stat-value">{orderStats.readyToServe}</div>
          </div>
        </div>
        <div className="stat-card purple">
          <div className="stat-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="stat-info">
            <div className="stat-label">Completed</div>
            <div className="stat-value">{orderStats.completed}</div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        {/* Recent Orders */}
        <div className="dashboard-section">
          <div className="section-header">
            <h3>In Progress</h3>
            <button className="view-all-btn" onClick={() => navigate('/recent-sales')}>See All Order →</button>
          </div>
          <div className="orders-list">
            {recentOrders.length === 0 ? (
              <div className="empty-state">No orders yet today</div>
            ) : (
              recentOrders.slice(0, 3).map(order => (
                <div key={String(order.id || order._id || Math.random())} className="order-card">
                  <div className="order-card-header">
                    <div className="order-id">Order# {order.token || 'N/A'}</div>
                    <div className="order-type">{order.orderType === 'dine-in' ? 'Dine In' : order.orderType === 'take-away' ? 'Take Away' : 'Delivery'}</div>
                    <div className="order-time">{formatDate(order.createdAt)}, {formatTime(order.createdAt)}</div>
                  </div>
                  <div className="order-card-body">
                    <div className="order-customer-avatar">
                      <span>{(order.customerName || 'G')[0].toUpperCase()}</span>
                    </div>
                    <div className="order-customer-info">
                      <div className="order-customer-name">Customer Name</div>
                      <div className="order-customer-value">{order.customerName || 'Guest'}</div>
                    </div>
                  </div>
                  <div className="order-card-footer">
                    <div className={`order-status ${order.orderType === 'dine-in' ? 'in-progress' : order.orderType === 'take-away' ? 'waiting' : 'delivery'}`}>
                      <span className="status-dot"></span>
                      {order.orderType === 'dine-in' ? 'In Progress' : order.orderType === 'take-away' ? 'Waiting for Payment' : 'Out for Delivery'}
                    </div>
                    <div className="order-meta">{order.items?.length || 0} Items →</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sales Overview */}
        <div className="dashboard-section">
          <div className="section-header">
            <h3>Sales Overview</h3>
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
              {[
                { key: 'today', label: 'Today' },
                { key: 'last7', label: 'Last 7 Days' },
                { key: 'month', label: 'This Month' }
              ].map(r => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  style={{
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: 6,
                    background: range === r.key ? '#fff' : 'transparent',
                    color: range === r.key ? '#0BAD95' : '#64748b',
                    fontWeight: range === r.key ? 600 : 500,
                    fontSize: 12,
                    cursor: 'pointer',
                    boxShadow: range === r.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="sales-chart">
            {kpisToday.gross > 0 ? (
              <div className="chart-bars">
                {[...Array(7)].map((_, i) => {
                  const height = Math.max(20, Math.random() * 80 + 20)
                  return (
                    <div key={i} className="chart-bar-wrapper">
                      <div className="chart-bar" style={{height: `${height}%`}}></div>
                      <div className="chart-label">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="empty-state">No sales data for today</div>
            )}
          </div>
          <div className="sales-legend">
            <div className="legend-item">
              <span className="legend-dot primary"></span>
              <span>Total Sales: {formatMoney(kpisToday.gross)}</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot success"></span>
              <span>Net: {formatMoney(Math.max(0, kpisToday.gross - kpisToday.discount - kpisToday.returned))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-actions">
        <button className="action-btn primary" onClick={() => navigate('/pos')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Create New Order
        </button>
        <button className="action-btn secondary" onClick={() => navigate('/sale-history')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          View Reports
        </button>
      </div>

      {/* Business Date Info */}
      <div className="dashboard-footer">
        <div className="business-info">
          <span>Business Date: <b>{getActiveBusinessDateId()}</b></span>
          <span className="divider">|</span>
          <span>Total Orders: <b>{orderStats.totalOrders}</b></span>
          <span className="divider">|</span>
          <span>Tokens: <b>{kpisToday.tokensGenerated}</b></span>
        </div>
      </div>

      {/* Calendar Widget */}
      <DashboardCalendar />
    </section>
  )
}
