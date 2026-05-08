import { useEffect, useState } from 'react'
import * as db from '../../services/db.js'

const ROLES = ['Admin','Manager','Cashier','Waiter','Chef','Receptionist','Sweeper','Guard','Delivery','Other']
const DEPARTMENTS = ['Management','Kitchen','Service','Operations','Other']
const SALARY_TYPES = ['monthly','daily','hourly']

const ROLE_DEPT_MAP = {
  Admin: 'Management', Manager: 'Management', Cashier: 'Service',
  Waiter: 'Service', Chef: 'Kitchen', Receptionist: 'Service',
  Sweeper: 'Operations', Guard: 'Operations', Delivery: 'Service', Other: 'Other',
}

const SYSTEM_ACCESS_ROLES = ['Admin','Manager','Cashier','Waiter','Chef','Receptionist']

export default function AddEditStaffPanel({ staff, preToggleSystemAccess, onClose, onSaved }) {
  const isEdit = !!staff
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '', fatherName: '', phone: '', cnic: '', address: '',
    profilePhoto: '', joiningDate: new Date().toISOString().split('T')[0],
    role: 'Waiter', department: 'Service', customRole: '',
    salaryType: 'monthly', salaryAmount: 0,
    hasSystemAccess: false, username: '', password: '', confirmPassword: '',
    status: 'active',
  })

  useEffect(() => {
    if (staff) {
      setForm({
        name: staff.name || '', fatherName: staff.fatherName || '', phone: staff.phone || '',
        cnic: staff.cnic || '', address: staff.address || '', profilePhoto: staff.profilePhoto || '',
        joiningDate: staff.joiningDate ? new Date(staff.joiningDate).toISOString().split('T')[0] : '',
        role: staff.role || 'Waiter', department: staff.department || 'Service', customRole: staff.customRole || '',
        salaryType: staff.salaryType || 'monthly', salaryAmount: staff.salaryAmount || 0,
        hasSystemAccess: staff.hasSystemAccess || false, username: '', password: '', confirmPassword: '',
        status: staff.status || 'active',
      })
    }
    if (preToggleSystemAccess) {
      setForm(prev => ({ ...prev, hasSystemAccess: true }))
    }
  }, [staff, preToggleSystemAccess])

  const update = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'role') {
        next.department = ROLE_DEPT_MAP[value] || 'Other'
      }
      return next
    })
  }

  const validate = () => {
    if (!form.name.trim()) return 'Name is required'
    if (!form.joiningDate) return 'Joining date is required'
    if (!form.role) return 'Role is required'
    if (form.role === 'Other' && !form.customRole.trim()) return 'Custom role is required when role is "Other"'
    if (form.hasSystemAccess) {
      if (!form.username.trim()) return 'Username is required for system access'
      if (!isEdit && !form.password) return 'Password is required for system access'
      if (form.password && form.password !== form.confirmPassword) return 'Passwords do not match'
      if (!SYSTEM_ACCESS_ROLES.includes(form.role)) return `Role "${form.role}" cannot have system access. Allowed: ${SYSTEM_ACCESS_ROLES.join(', ')}`
    }
    return null
  }

  const handleSave = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setSaving(true)

    try {
      if (!window.burgerPos) {
        setError('Backend not connected. If running in Electron, restart the app to load staff handlers.')
        setSaving(false)
        return
      }
      const data = {
        name: form.name, fatherName: form.fatherName, phone: form.phone,
        cnic: form.cnic, address: form.address, profilePhoto: form.profilePhoto,
        joiningDate: form.joiningDate, role: form.role, department: form.department,
        customRole: form.role === 'Other' ? form.customRole : '',
        salaryType: form.salaryType, salaryAmount: Number(form.salaryAmount) || 0,
        hasSystemAccess: form.hasSystemAccess, status: form.status,
      }

      if (form.hasSystemAccess && form.username) {
        data.username = form.username
        if (form.password) data.password = form.password
      }

      if (isEdit) {
        const res = await db.staff.update(staff._id, data)
        if (!res || res?.error) { setError(res?.error || 'Update failed. Please try again.'); setSaving(false); return }
      } else {
        const res = await db.staff.create(data)
        if (!res || res?.error) { setError(res?.error || 'Create failed. Please check console or try again.'); setSaving(false); return }
      }
      onSaved()
    } catch (e) {
      setError(e.message || 'Failed to save')
    }
    setSaving(false)
  }

  const salaryLabel = form.salaryType === 'daily' ? 'per day' : form.salaryType === 'hourly' ? 'per hour' : 'per month'

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '100vw', background: '#fff', boxShadow: '-8px 0 30px rgba(0,0,0,0.15)', zIndex: 10000, overflowY: 'auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{isEdit ? 'Edit Staff' : 'Add Staff'}</h2>
        <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#64748b' }}>✕</button>
      </div>

      {error && <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {/* Personal Info */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#0BAD95', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Personal Info</div>
        <div className="form"><label className="muted" style={{ fontSize: 11 }}>Full Name *</label><input className="input" value={form.name} onChange={e => update('name', e.target.value)} /></div>
        <div className="form"><label className="muted" style={{ fontSize: 11 }}>Father Name</label><input className="input" value={form.fatherName} onChange={e => update('fatherName', e.target.value)} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div className="form"><label className="muted" style={{ fontSize: 11 }}>Phone</label><input className="input" value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
          <div className="form"><label className="muted" style={{ fontSize: 11 }}>CNIC</label><input className="input" value={form.cnic} onChange={e => update('cnic', e.target.value)} /></div>
        </div>
        <div className="form"><label className="muted" style={{ fontSize: 11 }}>Address</label><input className="input" value={form.address} onChange={e => update('address', e.target.value)} /></div>
        <div className="form"><label className="muted" style={{ fontSize: 11 }}>Joining Date *</label><input type="date" className="input" value={form.joiningDate} onChange={e => update('joiningDate', e.target.value)} /></div>
      </div>

      {/* Role & Department */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#0BAD95', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Role & Department</div>
        <div className="form">
          <label className="muted" style={{ fontSize: 11 }}>Role *</label>
          <select className="input" value={form.role} onChange={e => update('role', e.target.value)}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        {form.role === 'Other' && (
          <div className="form"><label className="muted" style={{ fontSize: 11 }}>Specify Role</label><input className="input" value={form.customRole} onChange={e => update('customRole', e.target.value)} placeholder="e.g. Dishwasher" /></div>
        )}
        <div className="form">
          <label className="muted" style={{ fontSize: 11 }}>Department</label>
          <select className="input" value={form.department} onChange={e => update('department', e.target.value)}>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Salary */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#0BAD95', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Salary</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {SALARY_TYPES.map(t => (
            <button key={t} type="button" onClick={() => update('salaryType', t)}
              style={{ flex: 1, padding: '8px 0', border: '1px solid #e2e8f0', borderRadius: 8, background: form.salaryType === t ? '#0BAD95' : '#fff', color: form.salaryType === t ? '#fff' : '#475569', cursor: 'pointer', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
        </div>
        <div className="form">
          <label className="muted" style={{ fontSize: 11 }}>Amount (Rs.)</label>
          <input type="number" className="input" value={form.salaryAmount} onChange={e => update('salaryAmount', e.target.value)} min="0" />
          {Number(form.salaryAmount) > 0 && <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Rs.{Number(form.salaryAmount).toLocaleString()} {salaryLabel}</div>}
        </div>
      </div>

      {/* System Access */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#0BAD95', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>System Access</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24 }}>
            <input type="checkbox" checked={form.hasSystemAccess} onChange={e => update('hasSystemAccess', e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, background: form.hasSystemAccess ? '#0BAD95' : '#cbd5e1', borderRadius: 24, transition: '0.2s' }}>
              <span style={{ position: 'absolute', content: '""', height: 18, width: 18, left: form.hasSystemAccess ? 22 : 3, bottom: 3, background: '#fff', borderRadius: '50%', transition: '0.2s' }} />
            </span>
          </label>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Give System Login Access</span>
        </div>
        {form.hasSystemAccess && (
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
            {!SYSTEM_ACCESS_ROLES.includes(form.role) && (
              <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>Role "{form.role}" cannot have system access. Allowed roles: {SYSTEM_ACCESS_ROLES.join(', ')}</div>
            )}
            <div className="form"><label className="muted" style={{ fontSize: 11 }}>Username</label><input className="input" value={form.username} onChange={e => update('username', e.target.value)} /></div>
            <div className="form"><label className="muted" style={{ fontSize: 11 }}>Password {isEdit ? '(leave blank to keep current)' : '*'}</label><input type="password" className="input" value={form.password} onChange={e => update('password', e.target.value)} /></div>
            <div className="form"><label className="muted" style={{ fontSize: 11 }}>Confirm Password</label><input type="password" className="input" value={form.confirmPassword} onChange={e => update('confirmPassword', e.target.value)} /></div>
            <div className="muted" style={{ fontSize: 11 }}>System role: {form.role}</div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : isEdit ? 'Update Staff' : 'Add Staff'}
        </button>
      </div>
    </div>
  )
}
