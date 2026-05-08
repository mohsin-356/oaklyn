import { useState, useEffect } from 'react'
import { logout, getCurrentUser } from '../utils/storage.js'
import { useNavigate } from 'react-router-dom'
import { 
  logoutToCompany, 
  validateLicenseKeyForLogout, 
  isSuperAdminAuthenticated,
  clearAllAuth 
} from '../utils/jwtAuth.js'
import OaklynLogo from '../../img/Oaklyn.jpg'

export default function Logout(){
  const nav = useNavigate()
  const [licenseKey, setLicenseKey] = useState('')
  const [error, setError] = useState('')
  const [showLicense, setShowLicense] = useState(false)
  const [isSuperAdminLogout, setIsSuperAdminLogout] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  const currentUser = getCurrentUser()
  const isSuperAdmin = isSuperAdminAuthenticated()

  // Handle normal company logout (no license key needed)
  const handleCompanyLogout = async () => {
    setIsLoading(true)
    try {
      await logout()
      logoutToCompany() // Clear session but keep super admin auth
    } catch (e) {
      console.error('Logout error:', e)
    }
    setIsLoading(false)
    nav('/login')
  }

  // Handle super admin full logout (requires license key)
  const handleSuperAdminLogout = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    
    // Validate license key
    const isValid = validateLicenseKeyForLogout(licenseKey)
    
    if (isValid) {
      await new Promise(resolve => setTimeout(resolve, 500))
      await logout()
      clearAllAuth() // Clear super admin + session
      setIsLoading(false)
      nav('/super-admin')
    } else {
      setIsLoading(false)
      setError('Invalid license key. Super admin logout requires valid license key.')
    }
  }

  // If not showing super admin logout form, just do company logout
  useEffect(() => {
    if (!isSuperAdmin) {
      handleCompanyLogout()
    }
  }, [])

  // If not super admin, redirect immediately
  if (!isSuperAdmin) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{
          textAlign: 'center',
          color: 'white'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            border: '3px solid rgba(255,255,255,0.3)',
            borderTop: '3px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}/>
          <p>Logging out...</p>
          <style>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    )
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
              background: 'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)',
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
              Logout
            </div>

            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: '700', 
              marginBottom: '8px',
              color: '#1a202c'
            }}>
              {isSuperAdminLogout ? 'Super Admin Logout' : 'Company Logout'}
            </h2>
            <p style={{ 
              fontSize: '14px', 
              color: '#718096', 
              marginBottom: '24px' 
            }}>
              {isSuperAdminLogout 
                ? 'Enter license key to completely logout from the system' 
                : 'Select your logout option'}
            </p>

            {!isSuperAdminLogout ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  onClick={handleCompanyLogout}
                  className="submit-btn"
                  disabled={isLoading}
                  style={{ 
                    opacity: isLoading ? 0.7 : 1,
                    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'
                  }}
                >
                  {isLoading ? 'Logging out...' : 'Logout to Company Login'}
                </button>
                
                <button 
                  onClick={() => setIsSuperAdminLogout(true)}
                  style={{
                    padding: '14px 24px',
                    borderRadius: '10px',
                    border: '2px solid #fc4a1a',
                    background: 'white',
                    color: '#fc4a1a',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Full System Logout (Super Admin)
                </button>

                <button 
                  onClick={() => nav('/')}
                  style={{
                    padding: '12px',
                    border: 'none',
                    background: 'transparent',
                    color: '#718096',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <form onSubmit={handleSuperAdminLogout} className="login-form">
                <div className="form-group">
                  <label>License Key</label>
                  <div className="input-wrapper">
                    <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                    </svg>
                    <input
                      type={showLicense ? 'text' : 'password'}
                      placeholder="Enter license key to logout"
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
                  disabled={isLoading || !licenseKey}
                  style={{ 
                    opacity: (isLoading || !licenseKey) ? 0.7 : 1,
                    background: 'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)'
                  }}
                >
                  {isLoading ? 'Verifying...' : 'Complete Logout'}
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    setIsSuperAdminLogout(false)
                    setLicenseKey('')
                    setError('')
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    marginTop: '12px',
                    background: 'transparent',
                    border: '1px solid #E2E8F0',
                    borderRadius: '10px',
                    color: '#718096',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Back
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="login-right">
          <div className="illustration-container">
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center'
            }}>
              <div style={{
                width: '180px',
                height: '180px',
                background: 'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                boxShadow: '0 20px 60px rgba(252, 74, 26, 0.4)'
              }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16,17 21,12 16,7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </div>
              <h3 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: 'white',
                marginBottom: '8px'
              }}>
                Secure Logout
              </h3>
              <p style={{
                fontSize: '14px',
                color: 'rgba(255,255,255,0.8)',
                maxWidth: '250px',
                margin: '0 auto'
              }}>
                {isSuperAdminLogout 
                  ? 'License key required for complete system logout'
                  : 'Logout to company login or completely exit the system'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
