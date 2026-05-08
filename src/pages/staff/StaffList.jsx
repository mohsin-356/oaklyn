import { useEffect, useMemo, useState } from 'react'
import * as db from '../../services/db.js'
import AddEditStaffPanel from '../../components/staff/AddEditStaffPanel.jsx'

const ROLES = ['Admin','Manager','Cashier','Waiter','Chef','Receptionist','Sweeper','Guard','Delivery','Other']
const STATUSES = ['active','inactive','terminated']

const ROLE_COLORS = {
  Admin: '#1e3a5f', Manager: '#7c3aed', Cashier: '#0BAD95',
  Waiter: '#2563eb', Chef: '#ea580c', Receptionist: '#ec4899',
  Sweeper: '#6b7280', Guard: '#78716c', Delivery: '#0891b2', Other: '#9ca3af',
}
const STATUS_COLORS = {
  active: '#16a34a', inactive: '#d97706', terminated: '#dc2626',
}

function safe(v) { return isNaN(v) || v == null ? 0 : Number(v); }

export default function StaffList() {
  const [staff, setStaff] = useState([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showPanel, setShowPanel] = useState(false)
  const [editStaff, setEditStaff] = useState(null)
  const [loading, setLoading] = useState(true)
  const [contextMenu, setContextMenu] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const filters = {}
      if (roleFilter) filters.role = roleFilter
      if (statusFilter) filters.status = statusFilter
      const res = await db.staff.getAll(filters)
      setStaff(Array.isArray(res) ? res : [])
    } catch { setStaff([]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [roleFilter, statusFilter])

  const filtered = useMemo(() => {
    if (!search) return staff
    const q = search.toLowerCase()
    return staff.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.role || '').toLowerCase().includes(q) ||
      (s.phone || '').toLowerCase().includes(q)
    )
  }, [staff, search])

  const handleAdd = () => { setEditStaff(null); setShowPanel(true) }
  const handleEdit = (s) => { setEditStaff(s); setShowPanel(true) }
  const handleView = (s) => { setEditStaff(s); setShowPanel(true) }
  const handleSaved = () => { setShowPanel(false); setEditStaff(null); load(); try { window.dispatchEvent(new Event('data:staff-changed')) } catch {} }

  const handleTerminate = async (s) => {
    if (!confirm(`Terminate ${s.name}? This will also deactivate their system login if any.`)) return
    try { await db.staff.delete(s._id); load(); try { window.dispatchEvent(new Event('data:staff-changed')) } catch {} } catch {}
  }

  const handleMarkInactive = async (s) => {
    try { await db.staff.update(s._id, { status: 'inactive' }); load(); try { window.dispatchEvent(new Event('data:staff-changed')) } catch {} } catch {}
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>Staff Management</h1>
        <button className="btn primary" onClick={handleAdd}>+ Add Staff</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" placeholder="Search by name, role, phone..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
        <select className="input" value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ width: 150 }}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ width: 140 }}>
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        <span className="muted" style={{ fontSize: 13 }}>{filtered.length} staff</span>
      </div>

      {loading ? <div className="muted">Loading...</div> : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>#</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Photo</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Role</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Department</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Phone</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Salary</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr key={String(s._id || s.id || Math.random())} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px' }}>{i + 1}</td>
                  <td style={{ padding: '8px 12px' }}>
                    {s.profilePhoto ? (
                      <img src={s.profilePhoto} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#64748b' }}>
                        {(s.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.name}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                      background: ROLE_COLORS[s.role] || '#9ca3af', color: '#fff',
                    }}>{s.role === 'Other' ? (s.customRole || 'Other') : s.role}</span>
                  </td>
                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{s.department || '-'}</td>
                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{s.phone || '-'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    Rs.{safe(s.salaryAmount).toLocaleString()}
                    <span className="muted" style={{ fontSize: 11 }}>/{s.salaryType === 'daily' ? 'day' : s.salaryType === 'hourly' ? 'hr' : 'mo'}</span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                      background: STATUS_COLORS[s.status] || '#6b7280', color: '#fff',
                    }}>{s.status}</span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button className="btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => handleView(s)}>View</button>
                      <button className="btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => handleEdit(s)}>Edit</button>
                      <div style={{ position: 'relative' }}>
                        <button className="btn" style={{ padding: '4px 8px', fontSize: 14, lineHeight: 1 }} onClick={(e) => {
                          e.stopPropagation()
                          setContextMenu(String(contextMenu || '') === String(s._id || '') ? null : String(s._id || ''))
                        }}>⋮</button>
                        {String(contextMenu || '') === String(s._id || '') && (
                          <div style={{
                            position: 'absolute', right: 0, top: '100%', background: '#fff', border: '1px solid #e2e8f0',
                            borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 160, padding: 4,
                          }}>
                            <button style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12, borderRadius: 4 }}
                              onClick={() => { setContextMenu(null); handleView(s) }}>Salary History</button>
                            <button style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12, borderRadius: 4 }}
                              onClick={() => { setContextMenu(null); handleView(s) }}>Advances</button>
                            {s.status === 'active' && (
                              <button style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12, borderRadius: 4, color: '#d97706' }}
                                onClick={() => { setContextMenu(null); handleMarkInactive(s) }}>Mark Inactive</button>
                            )}
                            {s.status !== 'terminated' && (
                              <button style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12, borderRadius: 4, color: '#dc2626' }}
                                onClick={() => { setContextMenu(null); handleTerminate(s) }}>Terminate</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No staff found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Click outside to close context menu */}
      {contextMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setContextMenu(null)} />}

      {/* Add/Edit Slide-over Panel */}
      {showPanel && (
        <AddEditStaffPanel staff={editStaff} onClose={() => { setShowPanel(false); setEditStaff(null) }} onSaved={handleSaved} />
      )}
    </div>
  )
}
