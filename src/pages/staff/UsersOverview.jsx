import { useEffect, useState } from 'react'
import * as db from '../../services/db.js'
import AddEditStaffPanel from '../../components/staff/AddEditStaffPanel.jsx'
import { useDialog } from '../../components/ConfirmProvider.jsx'

const ROLE_ICONS = {
  Admin: '👑', Manager: '👔', Cashier: '💰', Waiter: '🍽️',
  Chef: '👨‍🍳', Receptionist: '📞', Sweeper: '🧹', Guard: '🛡️',
  Delivery: '🚗', Other: '👤',
}

export default function UsersOverview() {
  const toId = (raw) => {
    if (raw == null) return ''
    if (typeof raw === 'string' || typeof raw === 'number') return String(raw)
    if (typeof raw === 'object') {
      if (raw.$oid) return String(raw.$oid)
      if (raw.oid) return String(raw.oid)
      if (raw._id != null) return toId(raw._id)
      if (raw.id != null) return toId(raw.id)
      if (typeof raw.toString === 'function' && raw.toString !== Object.prototype.toString) {
        const s = String(raw.toString())
        return s === '[object Object]' ? '' : s
      }
      return ''
    }
    return String(raw)
  }

  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showPasswords, setShowPasswords] = useState(false)
  const dialog = useDialog()

  const load = async () => {
    setLoading(true)
    try {
      const [s, u] = await Promise.all([db.staff.getStats(), db.users.getAll()])
      setStats(s && !s.error ? s : null)
      const normalized = Array.isArray(u)
        ? u.map(user => ({ ...user, id: toId(user.id || user._id), _id: toId(user._id || user.id) }))
        : []
      setUsers(normalized)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleResetPassword = async (user) => {
    const userId = toId(user._id || user.id)
    if (!userId) { await dialog.alert({ title: 'Error', description: 'Invalid user id.' }); return }

    const newPwd = await dialog.prompt({
      title: 'Reset Password',
      description: `Set new password for ${user.name || user.username}`,
      inputLabel: 'New Password',
      placeholder: 'Enter new password',
      confirmText: 'Save',
    })

    if (!newPwd) return

    try {
      const result = await db.users.update(userId, { password: String(newPwd) })
      if (result && result.error) { await dialog.alert({ title: 'Failed', description: result.error }); return }
      await dialog.alert({ title: 'Success', description: 'Password updated successfully.' })
      load()
    } catch {
      await dialog.alert({ title: 'Failed', description: 'Failed to reset password.' })
    }
  }

  const handleToggleActive = async (user) => {
    const userId = toId(user._id || user.id)
    if (!userId) { await dialog.alert({ title: 'Error', description: 'Invalid user id.' }); return }
    const nextState = user.isActive === false
    const ok = await dialog.confirm({
      title: `${nextState ? 'Activate' : 'Deactivate'} User`,
      description: `${nextState ? 'Activate' : 'Deactivate'} ${user.name || user.username}?`,
      confirmText: nextState ? 'Activate' : 'Deactivate',
      cancelText: 'Cancel',
    })
    if (!ok) return

    try {
      const result = await db.users.update(userId, { isActive: nextState })
      if (result && result.error) { await dialog.alert({ title: 'Failed', description: result.error }); return }
      load()
    } catch {
      await dialog.alert({ title: 'Failed', description: 'Could not update user status.' })
    }
  }

  const handleDelete = async (user) => {
    const userId = toId(user._id || user.id)
    if (!userId) { await dialog.alert({ title: 'Error', description: 'Invalid user id.' }); return }
    const ok = await dialog.confirm({
      title: 'Delete User',
      description: `Delete user ${user.name || user.username}? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
    })
    if (!ok) return

    try {
      const result = await db.users.delete(userId)
      if (result && result.error) { await dialog.alert({ title: 'Failed', description: result.error }); return }
      load()
    } catch {
      await dialog.alert({ title: 'Failed', description: 'Could not delete user.' })
    }
  }

  const handleEditUser = async (user) => {
    const userId = toId(user._id || user.id)
    if (!userId) { await dialog.alert({ title: 'Error', description: 'Invalid user id.' }); return }

    const nextName = await dialog.prompt({
      title: 'Edit User',
      description: 'Update full name',
      inputLabel: 'Name',
      defaultValue: user.name || '',
      confirmText: 'Next',
    })
    if (nextName == null) return

    const nextUsername = await dialog.prompt({
      title: 'Edit User',
      description: 'Update username',
      inputLabel: 'Username',
      defaultValue: user.username || '',
      confirmText: 'Save',
    })
    if (nextUsername == null) return

    const payload = {
      name: String(nextName || '').trim(),
      username: String(nextUsername || '').trim(),
    }

    if (!payload.name || !payload.username) {
      await dialog.alert({ title: 'Missing fields', description: 'Name and username are required.' })
      return
    }

    try {
      const result = await db.users.update(userId, payload)
      if (result && result.error) { await dialog.alert({ title: 'Failed', description: result.error }); return }
      load()
    } catch {
      await dialog.alert({ title: 'Failed', description: 'Could not update user.' })
    }
  }

  const getPasswordDisplay = (user) => {
    if (!showPasswords) return '••••••••'
    if (user.password) return user.password
    if (user.passwordHash) return '[hashed]'
    return 'N/A'
  }

  if (loading) return <div className="muted">Loading...</div>

  const byRole = stats?.byUserRole || {}
  const roleEntries = Object.entries(byRole).filter(([_, c]) => c > 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>System Users Overview</h1>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>Staff members with system login access</p>
        </div>
        <button className="btn primary" onClick={() => setShowAdd(true)}>+ Add User</button>
      </div>

      {/* Password toggle */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={showPasswords} onChange={() => setShowPasswords(v => !v)} />
          Show Passwords
        </label>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="big" style={{ color: '#0BAD95' }}>{stats?.totalUsers || 0}</div>
          <div className="muted" style={{ fontSize: 12 }}>Total Users</div>
        </div>
        {Object.entries(byRole).map(([role, count]) => (
          <div key={role} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24 }}>{count}</div>
            <div className="muted" style={{ fontSize: 12 }}>{role}s</div>
          </div>
        ))}
      </div>

      {/* Role Breakdown Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 20 }}>
        {roleEntries.map(([role, count]) => {
          const roleUsers = users.filter(u => u.role === role)
          return (
            <div key={role} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{ROLE_ICONS[role] || '👤'} {role}s</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#0BAD95' }}>{count}</span>
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {roleUsers.map(u => <div key={toId(u._id || u.id) || `${role}-${u.username}`}>• {u.name || u.username}</div>)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Users Table */}
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Name</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Role</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Username</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Password</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Last Login</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Status</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: '#64748b' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={toId(u._id || u.id) || u.username} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{u.name || '-'}</td>
                <td style={{ padding: '8px 12px' }}>{u.role}</td>
                <td style={{ padding: '8px 12px', color: '#64748b' }}>{u.username}</td>
                <td style={{ padding: '8px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>{getPasswordDisplay(u)}</td>
                <td style={{ padding: '8px 12px', color: '#64748b', fontSize: 12 }}>
                  {u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Never'}
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
                    background: u.isActive !== false ? '#16a34a' : '#d97706', color: '#fff',
                  }}>{u.isActive !== false ? 'Active' : 'Inactive'}</span>
                </td>
                <td style={{ padding: '8px 12px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => handleEditUser(u)}>Edit</button>
                    <button className="btn" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => handleResetPassword(u)}>Change Password</button>
                    <button className="btn" style={{ padding: '4px 10px', fontSize: 11, color: '#d97706' }} onClick={() => handleToggleActive(u)}>{u.isActive === false ? 'Activate' : 'Deactivate'}</button>
                    <button className="btn danger" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => handleDelete(u)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddEditStaffPanel staff={null} preToggleSystemAccess={true} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load() }} />
      )}
    </div>
  )
}
