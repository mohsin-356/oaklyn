import { useEffect, useMemo, useState } from 'react'
import * as db from '../../services/db.js'
import AdvanceModal from '../../components/staff/AdvanceModal.jsx'

function safe(v) { return isNaN(v) || v == null ? 0 : Number(v); }

export default function AdvancesTab() {
  const [advances, setAdvances] = useState([])
  const [staff, setStaff] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [a, s] = await Promise.all([db.advance.getAll({}), db.staff.getAll({})])
      setAdvances(Array.isArray(a) ? a : [])
      setStaff(Array.isArray(s) ? s : [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!statusFilter) return advances
    return advances.filter(a => a.status === statusFilter)
  }, [advances, statusFilter])

  const handleApprove = async (adv) => {
    const deductMonth = prompt('Deduct from which month? (e.g. "April 2026")')
    if (!deductMonth) return
    try {
      await db.advance.approve(adv._id, 'Admin', deductMonth)
      load()
    } catch { alert('Failed to approve') }
  }

  const handleDecline = async (id) => {
    if (!confirm('Decline this advance?')) return
    try { await db.advance.decline(id); load() } catch {}
  }

  const statusColors = {
    pending: '#d97706', approved: '#16a34a', declined: '#dc2626', deducted: '#6b7280',
  }
  const statusLabels = {
    pending: '⏳ Pending', approved: '✅ Approved', declined: '❌ Declined', deducted: '✔ Deducted',
  }

  if (loading) return <div className="muted">Loading...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Salary Advances</h1>
        <button className="btn primary" onClick={() => setShowModal(true)}>+ Give Advance</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 150 }}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
          <option value="deducted">Deducted</option>
        </select>
        <span className="muted" style={{ fontSize: 13 }}>{filtered.length} advances</span>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Staff Name</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Role</th>
              <th style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b' }}>Amount</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Reason</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Requested</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Deduct Month</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Status</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => {
              const s = staff.find(s => String(s._id) === String(a.staffId))
              return (
                <tr key={String(a._id || a.id || Math.random())} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{a.staffName || s?.name || '-'}</td>
                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{s?.role || '-'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Rs.{safe(a.amount).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{a.reason || '-'}</td>
                  <td style={{ padding: '8px 12px', color: '#64748b', fontSize: 12 }}>{a.requestDate ? new Date(a.requestDate).toLocaleDateString() : a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '-'}</td>
                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{a.deductMonth || '-'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                      background: statusColors[a.status] || '#6b7280', color: '#fff',
                    }}>{statusLabels[a.status] || a.status}</span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {a.status === 'pending' && (
                        <>
                          <button className="btn" style={{ padding: '4px 10px', fontSize: 11, background: '#16a34a', borderColor: '#16a34a', color: '#fff' }} onClick={() => handleApprove(a)}>Approve</button>
                          <button className="btn danger" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => handleDecline(a._id)}>Decline</button>
                        </>
                      )}
                      {a.status === 'approved' && (
                        <span className="muted" style={{ fontSize: 11 }}>Will deduct from {a.deductMonth}</span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No advances found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <AdvanceModal staff={staff} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}
