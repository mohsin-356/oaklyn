import { useEffect, useMemo, useState } from 'react'
import * as db from '../../services/db.js'
import GenerateSalaryModal from '../../components/staff/GenerateSalaryModal.jsx'
import PaySalaryModal from '../../components/staff/PaySalaryModal.jsx'
import SalarySlip from '../../components/staff/SalarySlip.jsx'

function safe(v) { return isNaN(v) || v == null ? 0 : Number(v); }

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function SalaryTab() {
  const [records, setRecords] = useState([])
  const [staff, setStaff] = useState([])
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generateModal, setGenerateModal] = useState(null) // staff object
  const [payModal, setPayModal] = useState(null) // salary record
  const [slipRecord, setSlipRecord] = useState(null) // salary record for slip
  const [editRecord, setEditRecord] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [r, s] = await Promise.all([db.salary.getAll({}), db.staff.getAll({})])
      setRecords(Array.isArray(r) ? r : [])
      setStaff(Array.isArray(s) ? s : [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    return records.filter(r => r.month === month && r.year === year)
  }, [records, month, year])

  const totalPayroll = filtered.reduce((s, r) => s + safe(r.netSalary), 0)
  const paidTotal = filtered.filter(r => r.paymentStatus === 'paid').reduce((s, r) => s + safe(r.netSalary), 0)
  const pendingTotal = totalPayroll - paidTotal

  const handleGenerateAll = async () => {
    if (!confirm(`Generate salary for all active staff for ${MONTHS[month-1]} ${year}?`)) return
    setGenerating(true)
    const activeStaff = staff.filter(s => s.status === 'active')
    let generated = 0
    for (const s of activeStaff) {
      const exists = filtered.find(r => String(r.staffId) === String(s._id))
      if (!exists) {
        try {
          const res = await db.salary.generate(s._id, month, year)
          if (!res?.error) generated++
        } catch {}
      }
    }
    await load()
    setGenerating(false)
    alert(`Generated ${generated} salary records`)
  }

  const handleMarkPaid = async (id, paymentMethod, paidBy, notes) => {
    try {
      await db.salary.markPaid(id, paymentMethod, paidBy, notes)
      load()
    } catch { alert('Failed to mark as paid') }
  }

  const handleEditSave = async (id, data) => {
    try {
      await db.salary.update(id, data)
      setEditRecord(null)
      load()
    } catch { alert('Failed to update') }
  }

  if (loading) return <div className="muted">Loading...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Salary Management</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={handleGenerateAll} disabled={generating}>
            {generating ? 'Generating...' : 'Generate All Salaries'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="input" value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width: 140 }}>
          {MONTHS.map((n, i) => <option key={i+1} value={i+1}>{n}</option>)}
        </select>
        <input type="number" className="input" value={year} onChange={e => setYear(Number(e.target.value))} style={{ width: 90 }} />
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Staff Name</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Role</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>Basic</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>Allowances</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>Bonus</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>Deductions</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>Net Salary</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Status</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const totalDeduct = safe(r.advanceDeduct) + safe(r.lateDeduct) + safe(r.deductions)
              const isEditing = String(editRecord || '') === String(r._id || '')
              return (
                <tr key={String(r._id || r.id || Math.random())} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{r.staffName}</td>
                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{r.role}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>Rs.{safe(r.basicSalary).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>Rs.{safe(r.allowances).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right' }}>Rs.{safe(r.bonus).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#dc2626' }}>Rs.{totalDeduct.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#0BAD95' }}>Rs.{safe(r.netSalary).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                      background: r.paymentStatus === 'paid' ? '#16a34a' : r.paymentStatus === 'partial' ? '#2563eb' : '#d97706', color: '#fff',
                    }}>
                      {r.paymentStatus === 'paid' ? '✅ Paid' : r.paymentStatus === 'partial' ? '🔵 Partial' : '⏳ Pending'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {r.paymentStatus === 'pending' && (
                        <button className="btn" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setPayModal(r)}>Pay</button>
                      )}
                      <button className="btn" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setEditRecord(r._id)}>Edit</button>
                      <button className="btn" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setSlipRecord(r)}>Slip</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
                No salary records for {MONTHS[month-1]} {year}. Click "Generate All Salaries" to create.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Footer */}
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>Total Payroll</div>
          <div className="price" style={{ fontWeight: 700 }}>Rs.{totalPayroll.toLocaleString()}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>Paid</div>
          <div className="price" style={{ color: '#16a34a', fontWeight: 600 }}>Rs.{paidTotal.toLocaleString()}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>Pending</div>
          <div className="price" style={{ color: '#d97706', fontWeight: 600 }}>Rs.{pendingTotal.toLocaleString()}</div>
        </div>
      </div>

      {/* Generate Modal */}
      {generateModal && (
        <GenerateSalaryModal staff={generateModal} month={month} year={year} onClose={() => setGenerateModal(null)} onGenerated={load} />
      )}

      {/* Pay Modal */}
      {payModal && (
        <PaySalaryModal record={payModal} onClose={() => setPayModal(null)} onPaid={(id, method, paidBy, notes) => { setPayModal(null); handleMarkPaid(id, method, paidBy, notes) }} />
      )}

      {/* Salary Slip */}
      {slipRecord && (
        <SalarySlip record={slipRecord} onClose={() => setSlipRecord(null)} />
      )}

      {/* Edit Modal */}
      {editRecord && (() => {
        const r = filtered.find(rec => rec._id === editRecord)
        if (!r) return null
        return <EditSalaryModal record={r} onClose={() => setEditRecord(null)} onSave={handleEditSave} />
      })()}
    </div>
  )
}

function EditSalaryModal({ record, onClose, onSave }) {
  const [data, setData] = useState({
    basicSalary: record.basicSalary || 0,
    allowances: record.allowances || 0,
    bonus: record.bonus || 0,
    overtime: record.overtime || 0,
    overtimeHours: record.overtimeHours || 0,
    deductions: record.deductions || 0,
    advanceDeduct: record.advanceDeduct || 0,
    lateDeduct: record.lateDeduct || 0,
  })

  const safe = (v) => isNaN(v) || v == null ? 0 : Number(v)
  const gross = safe(data.basicSalary) + safe(data.allowances) + safe(data.bonus) + safe(data.overtime)
  const deduct = safe(data.deductions) + safe(data.advanceDeduct) + safe(data.lateDeduct)
  const net = Math.max(0, gross - deduct)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="card-title">Edit Salary — {record.staffName}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          <div className="form"><label className="muted" style={{ fontSize: 11 }}>Basic Salary</label><input type="number" className="input" value={data.basicSalary} onChange={e => setData({...data, basicSalary: Number(e.target.value)})} /></div>
          <div className="form"><label className="muted" style={{ fontSize: 11 }}>Allowances</label><input type="number" className="input" value={data.allowances} onChange={e => setData({...data, allowances: Number(e.target.value)})} /></div>
          <div className="form"><label className="muted" style={{ fontSize: 11 }}>Bonus</label><input type="number" className="input" value={data.bonus} onChange={e => setData({...data, bonus: Number(e.target.value)})} /></div>
          <div className="form"><label className="muted" style={{ fontSize: 11 }}>Overtime Amount</label><input type="number" className="input" value={data.overtime} onChange={e => setData({...data, overtime: Number(e.target.value)})} /></div>
          <div className="form"><label className="muted" style={{ fontSize: 11 }}>Other Deductions</label><input type="number" className="input" value={data.deductions} onChange={e => setData({...data, deductions: Number(e.target.value)})} /></div>
          <div className="form"><label className="muted" style={{ fontSize: 11 }}>Advance Deduction</label><input type="number" className="input" value={data.advanceDeduct} onChange={e => setData({...data, advanceDeduct: Number(e.target.value)})} /></div>
          <div className="form"><label className="muted" style={{ fontSize: 11 }}>Late Deduction</label><input type="number" className="input" value={data.lateDeduct} onChange={e => setData({...data, lateDeduct: Number(e.target.value)})} /></div>
        </div>
        <div style={{ marginTop: 12, padding: 12, background: '#f0fdf4', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>Gross: Rs.{gross.toLocaleString()} | Deductions: Rs.{deduct.toLocaleString()}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0BAD95' }}>Net: Rs.{net.toLocaleString()}</div>
        </div>
        <div className="actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => onSave(record._id, data)}>Save</button>
        </div>
      </div>
    </div>
  )
}
