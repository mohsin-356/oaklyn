import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { validateSuperAdmin, saveSuperAdminAuth } from '../utils/jwtAuth.js'
import OaklynLogo from '../../img/Oaklyn.jpg'

export default function SuperAdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [licenseKey, setLicenseKey] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showLicense, setShowLicense] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const nav = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Simulate network delay for security
    await new Promise(resolve => setTimeout(resolve, 800))

    const isValid = validateSuperAdmin(email, password, licenseKey)

    if (isValid) {
      saveSuperAdminAuth()
      setIsLoading(false)
      nav('/select-session')
    } else {
      setIsLoading(false)
      setError('Invalid credentials. Please check your email, password, and license key.')
    }
  }

  return (
    <section className="login-page">
      <div className="login-container">
        <div className="login-left">
          <div className="login-header">
            <div className="brand-logo">
              <img
                src={OaklynLogo}
                alt="Oaklyn"
                style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none' }}
              />
              <span className="brand-name">Oaklyn POS</span>
            </div>
          </div>

          <div className="login-form-wrapper">
            <div className="login-badge" style={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '20px',
              display: 'inline-block'
            }}>
              Super Admin Access
            </div>

            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              marginBottom: '8px',
              color: '#1a202c'
            }}>
              Welcome Back
            </h2>
            <p style={{ 
              fontSize: '14px', 
              color: '#718096', 
              marginBottom: '24px' 
            }}>
              Enter your super admin credentials to access the system
            </p>

            <form onSubmit={handleLogin} className="login-form">
              <div className="form-group">
                <label>Email Address</label>
                <div className="input-wrapper">
                  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <input
                    type="email"
                    placeholder="Enter super admin email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="input-wrapper">
                  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter super admin password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(v => !v)}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.02-2.78 2.86-5.06 5.12-6.56"/>
                        <path d="M1 1l22 22"/>
                        <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24"/>
                        <path d="M10.73 5.08A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a11.28 11.28 0 0 1-2.16 3.19"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>License Key</label>
                <div className="input-wrapper">
                  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                  </svg>
                  <input
                    type={showLicense ? 'text' : 'password'}
                    placeholder="Enter license key"
                    value={licenseKey}
                    onChange={e => setLicenseKey(e.target.value)}
                    required
                    disabled={isLoading}
                    style={{ fontFamily: showLicense ? 'inherit' : 'monospace', letterSpacing: showLicense ? 'inherit' : '1px' }}
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowLicense(v => !v)}
                    disabled={isLoading}
                  >
                    {showLicense ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.02-2.78 2.86-5.06 5.12-6.56"/>
                        <path d="M1 1l22 22"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="error-message" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              <button 
                type="submit" 
                className="submit-btn"
                disabled={isLoading}
                style={{ 
                  opacity: isLoading ? 0.7 : 1,
                  cursor: isLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {isLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20"/>
                    </svg>
                    Authenticating...
                  </span>
                ) : (
                  'Access System'
                )}
              </button>
            </form>
          </div>
        </div>

        <div className="login-right">
          <div className="illustration-container">
            <div className="security-icon" style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '200px',
              height: '200px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 20px 60px rgba(102, 126, 234, 0.4)'
            }}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M12 8v4"/>
                <path d="M12 16h.01"/>
              </svg>
            </div>

            <div className="content-card" style={{
              position: 'absolute',
              top: '20%',
              left: '10%',
              background: 'white',
              padding: '16px',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#667eea' }}>Super Admin</div>
              <div style={{ fontSize: '12px', color: '#718096' }}>Full System Access</div>
            </div>

            <div className="content-card" style={{
              position: 'absolute',
              bottom: '25%',
              right: '10%',
              background: 'white',
              padding: '16px',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#764ba2' }}>Licensed</div>
              <div style={{ fontSize: '12px', color: '#718096' }}>Secure Authentication</div>
            </div>

            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      </div>
    </section>
  )
}
