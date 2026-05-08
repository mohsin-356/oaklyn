import { useEffect, useState } from 'react'
import * as db from '../../services/db.js'

const ATTENDANCE_STATUS = [
  { value: 'present', label: '✅ Present', color: '#16a34a' },
  { value: 'absent', label: '❌ Absent', color: '#dc2626' },
  { value: 'late', label: '🕐 Late', color: '#d97706' },
  { value: 'half-day', label: '🌓 Half Day', color: '#2563eb' },
  { value: 'leave', label: '🌴 Leave', color: '#7c3aed' },
]

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function AttendanceTab() {
  const [staff, setStaff] = useState([])
  const [records, setRecords] = useState([])
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [viewMode, setViewMode] = useState('daily') // daily | monthly
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const s = await db.staff.getAll({ status: 'active' })
      setStaff(Array.isArray(s) ? s : [])
      const a = await db.attendance.getAll({ date: selectedDate })
      setRecords(Array.isArray(a) ? a : [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [selectedDate])

  const getRecord = (staffId) => records.find(r => String(r.staffId) === String(staffId))

  const handleStatusChange = (staffId, status) => {
    const existing = getRecord(staffId)
    if (existing) {
      setRecords(prev => prev.map(r => String(r.staffId) === String(staffId) ? { ...r, status } : r))
    } else {
      const s = staff.find(s => String(s._id) === String(staffId))
      setRecords(prev => [...prev, { staffId, staffName: s?.name || '', date: selectedDate, status, checkIn: '', checkOut: '', hoursWorked: 0, overtimeHours: 0 }])
    }
  }

  const handleFieldChange = (staffId, field, value) => {
    const existing = getRecord(staffId)
    if (existing) {
      setRecords(prev => prev.map(r => String(r.staffId) === String(staffId) ? { ...r, [field]: value } : r))
    } else {
      const s = staff.find(s => String(s._id) === String(staffId))
      setRecords(prev => [...prev, { staffId, staffName: s?.name || '', date: selectedDate, status: 'present', [field]: value }])
    }
  }

  const markAllPresent = () => {
    setRecords(prev => {
      const updated = [...prev]
      staff.forEach(s => {
        const idx = updated.findIndex(r => String(r.staffId) === String(s._id))
        if (idx >= 0) updated[idx] = { ...updated[idx], status: 'present' }
        else updated.push({ staffId: s._id, staffName: s.name, date: selectedDate, status: 'present', checkIn: '', checkOut: '', hoursWorked: 0, overtimeHours: 0 })
      })
      return updated
    })
  }

  const saveAttendance = async () => {
    setSaving(true)
    try {
      const recs = staff.map(s => {
        const r = getRecord(s._id) || { staffId: s._id, staffName: s.name, date: selectedDate, status: 'present' }
        return { ...r, staffId: s._id, staffName: s.name, date: selectedDate }
      })
      await db.attendance.bulkMark(selectedDate, recs)
      alert('Attendance saved successfully')
      load()
    } catch { alert('Failed to save attendance') }
    setSaving(false)
  }

  // Monthly view data
  const [monthlyRecords, setMonthlyRecords] = useState([])
  useEffect(() => {
    if (viewMode !== 'monthly') return
    const loadMonthly = async () => {
      try {
        const start = `${year}-${String(month).padStart(2,'0')}-01`
        const end = `${year}-${String(month).padStart(2,'0')}-31`
        const a = await db.attendance.getAll({})
        const filtered = (Array.isArray(a) ? a : []).filter(r => {
          if (!r.date) return false
          const [y, m] = r.date.split('-').map(Number)
          return y === year && m === month
        })
        setMonthlyRecords(filtered)
      } catch {}
    }
    loadMonthly()
  }, [viewMode, month, year])

  const daysInMonth = new Date(year, month, 0).getDate()

  // Summary
  const presentCount = staff.filter(s => (getRecord(s._id)?.status) === 'present').length
  const absentCount = staff.filter(s => (getRecord(s._id)?.status) === 'absent').length
  const lateCount = staff.filter(s => (getRecord(s._id)?.status) === 'late').length

  if (loading) return <div className="muted">Loading...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Attendance</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'inline-flex', border: '1px solid #e2e8f0', borderRadius: 9999, overflow: 'hidden' }}>
            <button style={{ padding: '6px 14px', border: 'none', background: viewMode === 'daily' ? '#0BAD95' : '#fff', color: viewMode === 'daily' ? '#fff' : '#475569', cursor: 'pointer', fontSize: 12, fontWeight: 600 }} onClick={() => setViewMode('daily')}>Daily</button>
            <button style={{ padding: '6px 14px', border: 'none', background: viewMode === 'monthly' ? '#0BAD95' : '#fff', color: viewMode === 'monthly' ? '#fff' : '#475569', cursor: 'pointer', fontSize: 12, fontWeight: 600 }} onClick={() => setViewMode('monthly')}>Monthly</button>
          </div>
        </div>
      </div>

      {viewMode === 'daily' ? (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="date" className="input" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ width: 170 }} />
            <button className="btn" onClick={markAllPresent}>Mark All Present</button>
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Name</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Role</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Status</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Check In</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Check Out</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Hours</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>OT</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => {
                  const rec = getRecord(s._id) || {}
                  return (
                    <tr key={String(s._id || s.id || Math.random())} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.name}</td>
                      <td style={{ padding: '8px 12px', color: '#64748b' }}>{s.role}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <select className="input" value={rec.status || 'present'} onChange={e => handleStatusChange(s._id, e.target.value)}
                          style={{ width: 130, padding: '4px 8px', fontSize: 12 }}>
                          {ATTENDANCE_STATUS.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="time" className="input" value={rec.checkIn || ''} onChange={e => handleFieldChange(s._id, 'checkIn', e.target.value)}
                          style={{ width: 100, padding: '4px 8px', fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="time" className="input" value={rec.checkOut || ''} onChange={e => handleFieldChange(s._id, 'checkOut', e.target.value)}
                          style={{ width: 100, padding: '4px 8px', fontSize: 12 }} />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="number" className="input" value={rec.hoursWorked || 0} onChange={e => handleFieldChange(s._id, 'hoursWorked', Number(e.target.value))}
                          style={{ width: 60, padding: '4px 8px', fontSize: 12 }} min="0" />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input type="number" className="input" value={rec.overtimeHours || 0} onChange={e => handleFieldChange(s._id, 'overtimeHours', Number(e.target.value))}
                          style={{ width: 60, padding: '4px 8px', fontSize: 12 }} min="0" />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <input className="input" value={rec.notes || ''} onChange={e => handleFieldChange(s._id, 'notes', e.target.value)}
                          style={{ width: 100, padding: '4px 8px', fontSize: 12 }} placeholder="Notes" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn primary" onClick={saveAttendance} disabled={saving}>
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>

          {/* Summary Card */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{staff.length}</div>
              <div className="muted" style={{ fontSize: 12 }}>Total Staff</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{presentCount}</div>
              <div className="muted" style={{ fontSize: 12 }}>Present</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{absentCount}</div>
              <div className="muted" style={{ fontSize: 12 }}>Absent</div>
            </div>
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#d97706' }}>{lateCount}</div>
              <div className="muted" style={{ fontSize: 12 }}>Late</div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
            <select className="input" value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 120 }}>
              {['January','February','March','April','May','June','July','August','September','October','November','December']
                .map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
            </select>
            <input type="number" className="input" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 90 }} />
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', color: '#64748b', position: 'sticky', left: 0, background: '#fff', zIndex: 1, minWidth: 120 }}>Staff</th>
                  {Array.from({ length: daysInMonth }, (_, i) => (
                    <th key={i+1} style={{ padding: '4px 2px', textAlign: 'center', color: '#64748b', minWidth: 28 }}>{i+1}</th>
                  ))}
                  <th style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b' }}>P</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b' }}>A</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', color: '#64748b' }}>%</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => {
                  const staffRecs = monthlyRecords.filter(r => String(r.staffId) === String(s._id))
                  const presentDays = staffRecs.filter(r => r.status === 'present' || r.status === 'late').length
                  const absentDays = staffRecs.filter(r => r.status === 'absent').length
                  const pct = daysInMonth > 0 ? Math.round((presentDays / daysInMonth) * 100) : 0
                  return (
                    <tr key={String(s._id || s.id || Math.random())} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '4px 8px', fontWeight: 600, position: 'sticky', left: 0, background: '#fff', zIndex: 1 }}>{s.name}</td>
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const day = i + 1
                        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                        const rec = staffRecs.find(r => r.date === dateStr)
                        const statusColors = { present: '#16a34a', absent: '#dc2626', late: '#d97706', 'half-day': '#2563eb', leave: '#7c3aed' }
                        const statusLabels = { present: 'P', absent: 'A', late: 'L', 'half-day': 'H', leave: 'Le' }
                        return (
                          <td key={day} style={{ padding: '2px', textAlign: 'center' }}>
                            {rec ? (
                              <span style={{ display: 'inline-block', width: 22, height: 22, lineHeight: '22px', borderRadius: 4, background: statusColors[rec.status] || '#e2e8f0', color: '#fff', fontSize: 9, fontWeight: 700 }}>
                                {statusLabels[rec.status] || '?'}
                              </span>
                            ) : (
                              <span style={{ display: 'inline-block', width: 22, height: 22, lineHeight: '22px', borderRadius: 4, background: '#f1f5f9', color: '#94a3b8', fontSize: 9 }}>-</span>
                            )}
                          </td>
                        )
                      })}
                      <td style={{ padding: '4px 8px', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{presentDays}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>{absentDays}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 600 }}>{pct}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
