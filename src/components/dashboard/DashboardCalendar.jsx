import { useEffect, useMemo, useState } from 'react'
import { listSales, listReturns, getBusinessDateId, getActiveBusinessDateId } from '../../utils/storage.js'

function formatMoney(n) {
  const v = isNaN(n) ? 0 : n
  return `Rs.${v.toFixed(0)}`
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10)
}

export default function DashboardCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [sales, setSales] = useState([])
  const [returns, setReturns] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)

  useEffect(() => {
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

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const today = new Date()
  const todayKey = toDateKey(today)

  // Build sales map by date
  const salesByDate = useMemo(() => {
    const map = {}
    sales.forEach(s => {
      const dateKey = s.bizId || getBusinessDateId(s.createdAt || Date.now())
      if (!map[dateKey]) {
        map[dateKey] = { sales: 0, orders: 0, items: 0, ordersList: [] }
      }
      map[dateKey].sales += Number(s.total) || 0
      map[dateKey].orders += 1
      map[dateKey].items += (s.items || []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
      map[dateKey].ordersList.push(s)
    })
    return map
  }, [sales])

  // Build returns map by date
  const returnsByDate = useMemo(() => {
    const map = {}
    returns.forEach(r => {
      const dateKey = r.bizId || getBusinessDateId(r.createdAt || Date.now())
      if (!map[dateKey]) {
        map[dateKey] = { returns: 0, count: 0 }
      }
      map[dateKey].returns += Number(r.total) || 0
      map[dateKey].count += 1
    })
    return map
  }, [returns])

  const calendarDays = useMemo(() => {
    const days = []
    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push({ empty: true, key: `empty-${i}` })
    }
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dateKey = toDateKey(date)
      const data = salesByDate[dateKey] || { sales: 0, orders: 0, items: 0, ordersList: [] }
      const returnData = returnsByDate[dateKey] || { returns: 0, count: 0 }
      const isToday = dateKey === todayKey
      const hasSales = data.sales > 0
      days.push({
        day,
        dateKey,
        date,
        isToday,
        hasSales,
        sales: data.sales,
        orders: data.orders,
        items: data.items,
        ordersList: data.ordersList,
        returns: returnData.returns,
        returnCount: returnData.count
      })
    }
    return days
  }, [firstDay, daysInMonth, year, month, salesByDate, returnsByDate, todayKey])

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
    setSelectedDate(null)
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
    setSelectedDate(null)
  }

  const handleDateClick = (dayData) => {
    if (!dayData.empty) {
      setSelectedDate(dayData)
    }
  }

  const closeSidePanel = () => {
    setSelectedDate(null)
  }

  // Calculate summary for selected date
  const selectedDateSummary = useMemo(() => {
    if (!selectedDate) return null
    const netSales = selectedDate.sales - (selectedDate.returns || 0)
    return {
      bills: selectedDate.orders,
      itemsSold: selectedDate.items,
      revenue: selectedDate.sales,
      returns: selectedDate.returns || 0,
      netRevenue: netSales
    }
  }, [selectedDate])

  return (
    <div className="dashboard-calendar-wrapper" style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Calendar Card */}
        <div className="card" style={{ flex: 1, padding: 24, background: '#fff', borderRadius: 12 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1e293b' }}>
              {monthNames[month]} {year}
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={prevMonth}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                ← Prev
              </button>
              <button
                onClick={nextMonth}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  background: '#fff',
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                Next →
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 12 }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b', padding: '8px 0' }}>
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {calendarDays.map((dayData, idx) => {
              if (dayData.empty) {
                return <div key={dayData.key} style={{ minHeight: 80 }} />
              }

              const isSelected = selectedDate?.dateKey === dayData.dateKey

              return (
                <button
                  key={dayData.dateKey}
                  onClick={() => handleDateClick(dayData)}
                  style={{
                    minHeight: 80,
                    padding: 8,
                    border: dayData.isToday ? '2px solid #0BAD95' : '1px solid #e2e8f0',
                    borderRadius: 8,
                    background: isSelected ? '#f0fdf9' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    position: 'relative',
                    transition: 'all 0.2s'
                  }}
                >
                  {/* Day Number */}
                  <div style={{
                    fontSize: 14,
                    fontWeight: dayData.isToday ? 700 : 600,
                    color: dayData.isToday ? '#0BAD95' : '#1e293b',
                    marginBottom: 4
                  }}>
                    {dayData.day}
                  </div>

                  {/* Sales Indicator */}
                  {dayData.hasSales && (
                    <>
                      <div style={{ fontSize: 11, color: '#0BAD95', fontWeight: 600, marginBottom: 2 }}>
                        {formatMoney(dayData.sales)}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>
                        {dayData.orders} orders
                      </div>
                      {/* Green dot indicator */}
                      <div style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#10D5B5'
                      }} />
                    </>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 12, height: 12, border: '2px solid #0BAD95', borderRadius: 4 }} />
              <span style={{ fontSize: 12, color: '#64748b' }}>Today</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10D5B5' }} />
              <span style={{ fontSize: 12, color: '#64748b' }}>Has Sales</span>
            </div>
          </div>
        </div>

        {/* Side Panel - Day Detail */}
        {selectedDate && (
          <div className="card" style={{ width: 340, padding: 20, background: '#fff', borderRadius: 12, position: 'sticky', top: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e293b' }}>
                {new Date(selectedDate.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h4>
              <button
                onClick={closeSidePanel}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                  color: '#64748b',
                  padding: 0,
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4
                }}
              >
                ×
              </button>
            </div>

            {/* Summary Cards */}
            {selectedDateSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Bills</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0BAD95' }}>{selectedDateSummary.bills}</div>
                </div>
                <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Items Sold</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0BAD95' }}>{selectedDateSummary.itemsSold}</div>
                </div>
                <div style={{ padding: 12, background: '#f0fdf9', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Revenue</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0BAD95' }}>{formatMoney(selectedDateSummary.revenue)}</div>
                </div>
                <div style={{ padding: 12, background: '#fef2f2', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Returns</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>{formatMoney(selectedDateSummary.returns)}</div>
                </div>
              </div>
            )}

            {/* Orders List */}
            <div>
              <h5 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 600, color: '#334155' }}>
                Orders ({selectedDate.ordersList.length})
              </h5>
              <div className="custom-scrollbar" style={{ maxHeight: 300, overflowY: 'auto' }}>
                {selectedDate.ordersList.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    No orders for this date
                  </div>
                ) : (
                  selectedDate.ordersList.map(order => (
                    <div
                      key={String(order.id || order._id || Math.random())}
                      style={{
                        padding: 12,
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>
                          Token #{order.token || 'N/A'}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                          {order.customerName || 'Walk-in'}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0BAD95' }}>
                        {formatMoney(Number(order.total) || 0)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
