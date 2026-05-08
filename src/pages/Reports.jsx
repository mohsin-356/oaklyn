import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  listSales, listReturns, getBusinessDateId, getActiveBusinessDateId,
  getRestaurantInfo, getAllCatalog
} from '../utils/storage.js'
import { listAllRecipes, getRecipe } from '../utils/recipes.js'

const COLORS = ['#0BAD95', '#10D5B5', '#08917D', '#14B8A6', '#2DD4BF']

export default function Reports() {
  const [activeTab, setActiveTab] = useState('summary')
  const [dateRange, setDateRange] = useState('today')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [sales, setSales] = useState([])
  const [returns, setReturns] = useState([])
  const [searchItem, setSearchItem] = useState('')
  const [sortBy, setSortBy] = useState('qty')
  const [sortDesc, setSortDesc] = useState(true)
  const [mounted, setMounted] = useState(false)

  // Ingredient usage states
  const [selectedDate, setSelectedDate] = useState(() => {
    try { return getActiveBusinessDateId() } catch { return getBusinessDateId(Date.now()) }
  })

  useEffect(() => {
    setMounted(true)
    const load = async () => {
      try {
        setSales((await listSales()) || [])
        setReturns((await listReturns()) || [])
      } catch (e) {
        console.error('Error loading sales:', e)
      }
    }
    load()
    const onSales = () => load()
    const onReturns = () => load()
    window.addEventListener('data:sales-changed', onSales)
    window.addEventListener('data:returns-changed', onReturns)
    window.addEventListener('storage', load)
    return () => {
      window.removeEventListener('data:sales-changed', onSales)
      window.removeEventListener('data:returns-changed', onReturns)
      window.removeEventListener('storage', load)
    }
  }, [])

  // Date range filtering
  const filteredSales = useMemo(() => {
    const now = Date.now()
    const today = getBusinessDateId(now)
    const startOfWeek = new Date(now)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
    const weekStart = getBusinessDateId(startOfWeek.getTime())
    const startOfMonth = new Date(now)
    startOfMonth.setDate(1)
    const monthStart = getBusinessDateId(startOfMonth.getTime())

    return sales.filter(s => {
      const bizId = s.bizId || getBusinessDateId(s.createdAt || Date.now())
      if (dateRange === 'today') return bizId === today
      if (dateRange === 'week') return bizId >= weekStart
      if (dateRange === 'month') return bizId >= monthStart
      if (dateRange === 'custom' && customStart && customEnd) {
        return bizId >= customStart && bizId <= customEnd
      }
      return true
    })
  }, [sales, dateRange, customStart, customEnd])

  const filteredReturns = useMemo(() => {
    const returnIds = new Set(returns.map(r => String(r.referenceSaleId || '')))
    return returns.filter(r => {
      const bizId = r.bizId || getBusinessDateId(r.createdAt || Date.now())
      if (dateRange === 'today') {
        const today = getBusinessDateId(Date.now())
        return bizId === today
      }
      if (dateRange === 'week') {
        const now = Date.now()
        const startOfWeek = new Date(now)
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
        return bizId >= getBusinessDateId(startOfWeek.getTime())
      }
      if (dateRange === 'month') {
        const now = Date.now()
        const startOfMonth = new Date(now)
        startOfMonth.setDate(1)
        return bizId >= getBusinessDateId(startOfMonth.getTime())
      }
      if (dateRange === 'custom' && customStart && customEnd) {
        return bizId >= customStart && bizId <= customEnd
      }
      return true
    })
  }, [returns, dateRange, customStart, customEnd])

  // KPI Calculations
  const kpis = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0)
    const totalOrders = filteredSales.length
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0
    const returnedAmount = filteredReturns.reduce((sum, r) => sum + (Number(r.total) || 0), 0)
    const netRevenue = Math.max(0, totalRevenue - returnedAmount)

    // Top selling item
    const itemCounts = {}
    filteredSales.forEach(s => {
      (s.items || []).forEach(it => {
        itemCounts[it.name] = (itemCounts[it.name] || 0) + (Number(it.qty) || 0)
      })
    })
    const topItem = Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'

    return { totalRevenue, totalOrders, avgOrderValue, netRevenue, topItem }
  }, [filteredSales, filteredReturns])

  // Hourly/Daily revenue data for bar chart
  const revenueChartData = useMemo(() => {
    if (dateRange === 'today') {
      // Hourly breakdown
      const hourly = Array(24).fill(0).map((_, i) => ({ label: `${i}:00`, value: 0 }))
      filteredSales.forEach(s => {
        const hour = new Date(s.createdAt || Date.now()).getHours()
        hourly[hour].value += Number(s.total) || 0
      })
      return hourly.filter(h => h.value > 0).length > 0 ? hourly : hourly.slice(8, 22)
    } else {
      // Daily breakdown for week/month
      const daily = {}
      filteredSales.forEach(s => {
        const date = s.bizId || getBusinessDateId(s.createdAt || Date.now())
        daily[date] = (daily[date] || 0) + (Number(s.total) || 0)
      })
      return Object.entries(daily).map(([date, value]) => ({
        label: date.slice(5), // MM-DD
        value
      })).sort((a, b) => a.label.localeCompare(b.label))
    }
  }, [filteredSales, dateRange])

  // Order type breakdown for pie chart
  const orderTypeData = useMemo(() => {
    const types = { 'Dine-in': 0, 'Takeaway': 0, 'Delivery': 0 }
    filteredSales.forEach(s => {
      const type = (s.orderType || 'Take-Away').toLowerCase()
      if (type.includes('dine')) types['Dine-in'] += Number(s.total) || 0
      else if (type.includes('delivery')) types['Delivery'] += Number(s.total) || 0
      else types['Takeaway'] += Number(s.total) || 0
    })
    return Object.entries(types)
      .filter(([_, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
  }, [filteredSales])

  // Item Consumption data
  const itemConsumption = useMemo(() => {
    const map = new Map()
    filteredSales.forEach(s => {
      (s.items || []).forEach((it, idx) => {
        const key = it.name + '_' + idx
        const prev = map.get(key) || { name: it.name, qty: 0, revenue: 0 }
        prev.qty += Number(it.qty) || 0
        prev.revenue += (Number(it.qty) || 0) * (Number(it.price) || 0)
        map.set(key, prev)
      })
    })
    let arr = Array.from(map.values())
    const totalRevenue = arr.reduce((sum, r) => sum + r.revenue, 0)
    arr = arr.map(r => ({ ...r, percent: totalRevenue > 0 ? (r.revenue / totalRevenue * 100).toFixed(1) : 0 }))

    // Search filter
    const q = searchItem.toLowerCase()
    if (q) arr = arr.filter(r => (r.name || '').toLowerCase().includes(q))

    // Sort
    arr.sort((a, b) => {
      const valA = sortBy === 'qty' ? a.qty : sortBy === 'revenue' ? a.revenue : parseFloat(a.percent)
      const valB = sortBy === 'qty' ? b.qty : sortBy === 'revenue' ? b.revenue : parseFloat(b.percent)
      return sortDesc ? valB - valA : valA - valB
    })
    return arr
  }, [filteredSales, searchItem, sortBy, sortDesc])

  // Ingredient Usage data (from Recipes)
  const [allRecipes, setAllRecipes] = useState({})
  useEffect(() => { listAllRecipes().then(r => setAllRecipes(r)).catch(()=>{}) }, [sales])
  const daySoldByItem = useMemo(() => {
    const acc = {}
    filteredSales.forEach(s => {
      (s.items || []).forEach(it => {
        acc[it.id] = (acc[it.id] || 0) + (parseFloat(it.qty) || 0)
      })
    })
    filteredReturns.forEach(r => {
      (r.items || []).forEach(it => {
        acc[it.id] = (acc[it.id] || 0) - (parseFloat(it.qty) || 0)
      })
    })
    return acc
  }, [filteredSales, filteredReturns])

  const ingredientUsage = useMemo(() => {
    const usage = {}
    for (const [itemId, soldQty] of Object.entries(daySoldByItem)) {
      if (!soldQty) continue
      const rec = (allRecipes[itemId] || [])
      rec.forEach((ing) => {
        const per = parseFloat(ing?.qty) || 0
        const unitRaw = (ing?.unit || '')
        const nameRaw = (ing?.name || '')
        if (!nameRaw) return
        const key = `${nameRaw.trim().toLowerCase()}@@${unitRaw.trim().toLowerCase()}`
        if (!usage[key]) usage[key] = { name: nameRaw.trim(), unit: unitRaw.trim(), qty: 0, cost: 0 }
        usage[key].qty += per * soldQty
      })
    }
    return Object.values(usage).sort((a, b) => b.qty - a.qty)
  }, [daySoldByItem, allRecipes])

  const totalIngredientCost = useMemo(() => {
    return ingredientUsage.reduce((sum, ing) => sum + (ing.cost || 0), 0)
  }, [ingredientUsage])

  // Staff Report data
  const staffReport = useMemo(() => {
    const staff = {}
    filteredSales.forEach(s => {
      const cashier = s.cashier || 'Unknown'
      if (!staff[cashier]) staff[cashier] = { name: cashier, orders: 0, revenue: 0 }
      staff[cashier].orders += 1
      staff[cashier].revenue += Number(s.total) || 0
    })
    return Object.values(staff).sort((a, b) => b.revenue - a.revenue)
  }, [filteredSales])

  // Export functions
  const exportToPDF = async () => {
    const rest = getRestaurantInfo()
    try {
      await ensureJsPdfLoaded()
      const { jsPDF } = window.jspdf
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 50
      let y = margin

      doc.setFontSize(20)
      doc.text('Reports', pageWidth / 2, y, { align: 'center' })
      y += 30
      doc.setFontSize(12)
      doc.text(`Period: ${dateRange}`, pageWidth / 2, y, { align: 'center' })
      y += 40

      // KPIs
      doc.setFontSize(14)
      doc.text('Sales Summary', margin, y)
      y += 25
      doc.setFontSize(11)
      doc.text(`Total Revenue: Rs.${kpis.totalRevenue.toFixed(2)}`, margin, y)
      y += 18
      doc.text(`Total Orders: ${kpis.totalOrders}`, margin, y)
      y += 18
      doc.text(`Average Order: Rs.${kpis.avgOrderValue.toFixed(2)}`, margin, y)
      y += 18
      doc.text(`Top Item: ${kpis.topItem}`, margin, y)
      y += 40

      // Item Consumption
      if (itemConsumption.length > 0) {
        doc.setFontSize(14)
        doc.text('Item Consumption', margin, y)
        y += 25
        doc.setFontSize(10)
        itemConsumption.slice(0, 20).forEach(r => {
          if (y > 750) { doc.addPage(); y = margin }
          doc.text(`${r.name} | Qty: ${r.qty} | Rs.${r.revenue.toFixed(2)}`, margin, y)
          y += 16
        })
      }

      doc.save(`Reports_${dateRange}_${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      alert('PDF export failed: ' + e.message)
    }
  }

  const exportToExcel = () => {
    const rows = itemConsumption.map(r => ({
      Item: r.name,
      'Qty Sold': r.qty,
      Revenue: r.revenue.toFixed(2),
      '% of Total': r.percent + '%'
    }))
    const csv = [
      Object.keys(rows[0] || {}).join(','),
      ...rows.map(r => Object.values(r).join(','))
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ItemConsumption_${dateRange}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function ensureJsPdfLoaded() {
    return new Promise((resolve, reject) => {
      if (window.jspdf && window.jspdf.jsPDF) return resolve()
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
      script.async = true
      script.onload = () => { if (window.jspdf && window.jspdf.jsPDF) resolve(); else reject(new Error('jsPDF not available')) }
      script.onerror = () => reject(new Error('Failed to load jsPDF'))
      document.head.appendChild(script)
    })
  }

  return (
    <section className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ margin: 0 }}>Reports</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Date Range Selector */}
          <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 8 }}>
            {[
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: 'custom', label: 'Custom' }
            ].map(r => (
              <button
                key={r.key}
                onClick={() => setDateRange(r.key)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: 6,
                  background: dateRange === r.key ? '#fff' : 'transparent',
                  color: dateRange === r.key ? '#0BAD95' : '#64748b',
                  fontWeight: dateRange === r.key ? 600 : 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  boxShadow: dateRange === r.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          {dateRange === 'custom' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6 }} />
              <span style={{ color: '#94a3b8' }}>to</span>
              <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6 }} />
            </div>
          )}
          <button className="btn" onClick={exportToPDF}>Export PDF</button>
          <button className="btn" onClick={exportToExcel}>Export Excel</button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e2e8f0', marginBottom: 24 }}>
        {[
          { key: 'summary', label: 'Sales Summary', icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
          )},
          { key: 'items', label: 'Item Consumption', icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          )},
          { key: 'ingredients', label: 'Ingredient Usage', icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-2.072-2.143-3-2.143s-1.928 0-3 2.143C3.5 10 3 10.62 3 12a2.5 2.5 0 0 0 2.5 2.5"/><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3-2-3s-2 1-2 3c0 2.5-2 2.5-2 2.5s-2 0-2-2.5c0-2-1-3-2-3s-2 1-2 3a7 7 0 0 0 7 7z"/></svg>
          )},
          { key: 'staff', label: 'Staff Report', icon: (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          )}
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '12px 20px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === tab.key ? '3px solid #0BAD95' : '3px solid transparent',
              color: activeTab === tab.key ? '#0BAD95' : '#64748b',
              fontWeight: activeTab === tab.key ? 600 : 500,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Sales Summary */}
      {activeTab === 'summary' && (
        <div>
          {/* KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total Revenue', value: `Rs.${kpis.totalRevenue.toFixed(2)}`, color: '#0BAD95' },
              { label: 'Total Orders', value: kpis.totalOrders, color: '#10D5B5' },
              { label: 'Avg Order Value', value: `Rs.${kpis.avgOrderValue.toFixed(2)}`, color: '#08917D' },
              { label: 'Net Revenue', value: `Rs.${kpis.netRevenue.toFixed(2)}`, color: '#14B8A6' },
              { label: 'Top Selling Item', value: kpis.topItem, color: '#2DD4BF', small: true }
            ].map((kpi, i) => (
              <div key={i} className="card" style={{ borderLeft: `4px solid ${kpi.color}`, padding: 20 }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 500 }}>{kpi.label}</div>
                <div style={{ fontSize: kpi.small ? 16 : 24, fontWeight: 700, color: '#1e293b' }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
            {/* Revenue Bar Chart */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: 16, color: '#334155' }}>
                Revenue {dateRange === 'today' ? 'by Hour' : 'by Day'}
              </h3>
              {mounted ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={revenueChartData}>
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `Rs.${v}`} />
                    <Tooltip formatter={v => [`Rs.${Number(v).toFixed(2)}`, 'Revenue']} />
                    <Bar dataKey="value" fill="#0BAD95" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Loading chart...</div>
              )}
            </div>

            {/* Order Type Donut Chart */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: 16, color: '#334155' }}>Order Type Breakdown</h3>
              {mounted && orderTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={orderTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {orderTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip formatter={v => [`Rs.${Number(v).toFixed(2)}`, 'Revenue']} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No data available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Item Consumption */}
      {activeTab === 'items' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              className="input"
              placeholder="Search items..."
              value={searchItem}
              onChange={e => setSearchItem(e.target.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <select
              className="input"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ width: 140 }}
            >
              <option value="qty">Sort by Qty</option>
              <option value="revenue">Sort by Revenue</option>
              <option value="percent">Sort by %</option>
            </select>
            <button className="btn" onClick={() => setSortDesc(!sortDesc)}>
              {sortDesc ? '↓ Desc' : '↑ Asc'}
            </button>
          </div>

          <div className="card">
            <div className="bill-head" style={{ gridTemplateColumns: '1fr 120px 140px 100px' }}>
              <div>Item</div>
              <div style={{ textAlign: 'right' }}>Qty Sold</div>
              <div style={{ textAlign: 'right' }}>Revenue (Rs.)</div>
              <div style={{ textAlign: 'right' }}>% of Total</div>
            </div>
            {itemConsumption.length === 0 && <div className="muted" style={{ padding: 20 }}>No items found.</div>}
            {itemConsumption.map((r, i) => (
              <div key={`item-${i}`} className="bill-row" style={{ gridTemplateColumns: '1fr 120px 140px 100px' }}>
                <div className="grow">{r.name}</div>
                <div style={{ textAlign: 'right' }}>{r.qty}</div>
                <div className="price" style={{ textAlign: 'right' }}>Rs.{r.revenue.toFixed(2)}</div>
                <div style={{ textAlign: 'right', color: '#0BAD95', fontWeight: 600 }}>{r.percent}%</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Ingredient Usage */}
      {activeTab === 'ingredients' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label className="muted">Date:</label>
              <input
                type="date"
                className="input"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                style={{ width: 160 }}
              />
            </div>
            <div className="card" style={{ padding: '8px 16px', background: '#f0fdf9' }}>
              <span style={{ fontSize: 13, color: '#0BAD95', fontWeight: 600 }}>
                Total Ingredients: {ingredientUsage.length}
              </span>
            </div>
          </div>

          <div className="card">
            <div className="bill-head" style={{ gridTemplateColumns: '1fr 100px 140px' }}>
              <div>Ingredient</div>
              <div style={{ textAlign: 'right' }}>Unit</div>
              <div style={{ textAlign: 'right' }}>Qty Used</div>
            </div>
            {ingredientUsage.length === 0 && (
              <div className="muted" style={{ padding: 20 }}>
                No ingredient usage data. Make sure recipes are configured for items.
              </div>
            )}
            {ingredientUsage.map((ing, i) => (
              <div key={i} className="bill-row" style={{ gridTemplateColumns: '1fr 100px 140px' }}>
                <div className="grow">{ing.name}</div>
                <div style={{ textAlign: 'right', color: '#64748b' }}>{ing.unit || '-'}</div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>{ing.qty.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Staff Report */}
      {activeTab === 'staff' && (
        <div>
          <div className="card" style={{ marginBottom: 16, padding: 16, background: '#f0fdf9', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Active Staff</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#0BAD95' }}>{staffReport.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748b' }}>Total Orders</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e293b' }}>
                {staffReport.reduce((sum, s) => sum + s.orders, 0)}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="bill-head" style={{ gridTemplateColumns: '1fr 120px 140px' }}>
              <div>Cashier Name</div>
              <div style={{ textAlign: 'right' }}>Orders</div>
              <div style={{ textAlign: 'right' }}>Revenue (Rs.)</div>
            </div>
            {staffReport.length === 0 && (
              <div className="muted" style={{ padding: 20 }}>No staff activity recorded.</div>
            )}
            {staffReport.map((s, i) => (
              <div key={`staff-${i}`} className="bill-row" style={{ gridTemplateColumns: '1fr 120px 140px' }}>
                <div className="grow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: '#0BAD95',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 600, fontSize: 12
                  }}>
                    {s.name.slice(0, 2).toUpperCase()}
                  </div>
                  {s.name}
                </div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>{s.orders}</div>
                <div className="price" style={{ textAlign: 'right' }}>Rs.{s.revenue.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
