import { useState } from 'react'
import { verifyAdminCredentials } from '../utils/storage.js'

export default function AdminAuthModal({ onVerified, onCancel }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password')
      return
    }
    setLoading(true)
    try {
      const result = await verifyAdminCredentials(username.trim(), password)
      if (result && result.success) {
        onVerified(result.adminName)
      } else {
        setError(result?.message || 'Invalid admin credentials')
      }
    } catch (err) {
      setError('Verification failed. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div style={{
        backgroundColor: '#fff', borderRadius: 16, padding: '32px',
        width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', background: '#fef3c7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px', fontSize: 28,
          }}>🔒</div>
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e293b' }}>Admin Authorization Required</h3>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#64748b' }}>
            Enter admin credentials to proceed with reprint
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Admin Username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter admin username"
              autoFocus
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                border: '2px solid #e2e8f0', fontSize: 15, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter admin password"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 10,
                border: '2px solid #e2e8f0', fontSize: 15, outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 16,
              background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 600,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #d1d5db',
                background: '#fff', color: '#475569', fontSize: 15, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                background: loading ? '#94a3b8' : '#2563eb', color: '#fff',
                fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Verifying...' : 'Authorize'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
