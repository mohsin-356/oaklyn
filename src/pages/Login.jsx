import { useEffect, useState } from 'react'
import { loginAdmin, loginCashier, getCurrentUser, getRestaurantInfo, getCashiers } from '../utils/storage.js'
import { useNavigate } from 'react-router-dom'
import { getValidSession, getSessionRemainingTime, isSessionExpired } from '../utils/jwtAuth.js'
import OaklynLogo from '../../img/Oaklyn.jpg'

export default function Login(){
  const [loginMode, setLoginMode] = useState('admin') // 'admin' | 'cashier'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [selectedCashierId, setSelectedCashierId] = useState('')
  const [cashiers, setCashiers] = useState([])
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [brandName, setBrandName] = useState(() => {
    try {
      const info = getRestaurantInfo()
      return (info && info.name) ? String(info.name) : 'Oaklyn'
    } catch {
      return 'Oaklyn'
    }
  })
  const nav = useNavigate()

  // Check if session is valid
  useEffect(()=>{
    // If session is expired, redirect to super admin
    if (isSessionExpired()) {
      nav('/super-admin')
      return
    }
    
    const u = getCurrentUser()
    if (u) nav('/')
  },[nav])

  useEffect(() => {
    const refresh = () => {
      try {
        const info = getRestaurantInfo()
        setBrandName((info && info.name) ? String(info.name) : 'Oaklyn')
      } catch {
        setBrandName('Oaklyn')
      }
    }
    refresh()
    window.addEventListener('restaurantInfo:updated', refresh)
    return () => window.removeEventListener('restaurantInfo:updated', refresh)
  }, [])

  // Load cashiers
  useEffect(() => {
    getCashiers().then(c => setCashiers(Array.isArray(c) ? c : [])).catch(() => {})
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    try {
      if (loginMode === 'admin') {
        const u = await loginAdmin(username, password)
        if (u) nav('/')
        else setError('Invalid admin username or password')
      } else {
        if (!selectedCashierId) {
          setError('Please select a cashier profile')
          return
        }
        const u = await loginCashier(selectedCashierId, password)
        if (u) nav('/')
        else setError('Invalid password for selected cashier')
      }
    } catch { setError('Login failed') }
  }

  return (
    <section className="login-page">
      <div className="login-container">
        {/* Left Side - Form */}
        <div className="login-left">
          <div className="login-header">
            <div className="brand-logo">
              <img
                src={OaklynLogo}
                alt={brandName || 'Oaklyn'}
                style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }}
                onError={(e) => { e.target.style.display = 'none' }}
              />
              <span className="brand-name">{brandName}</span>
            </div>
          </div>

          <div className="login-form-wrapper">
            {/* Session Info Badge */}
            <div style={{
              background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              marginBottom: '16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12,6 12,12 16,14"/>
              </svg>
              Session: {getSessionRemainingTime()}
            </div>

            {/* Login Mode Toggle */}
            <div className="login-mode-toggle">
              <button
                className={`mode-btn ${loginMode === 'admin' ? 'active' : ''}`}
                onClick={() => { setLoginMode('admin'); setError('') }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                Admin Login
              </button>
              <button
                className={`mode-btn ${loginMode === 'cashier' ? 'active' : ''}`}
                onClick={() => { setLoginMode('cashier'); setError('') }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                </svg>
                Cashier Login
              </button>
            </div>

            <form onSubmit={handleLogin} className="login-form">
              {loginMode === 'admin' ? (
                <>
                  <div className="form-group">
                    <label>Username</label>
                    <div className="input-wrapper">
                      <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                      <input
                        type="text"
                        placeholder="Enter admin username"
                        value={username}
                        onChange={e=>setUsername(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label>Select Cashier</label>
                    <div className="cashier-profiles">
                      {cashiers.length === 0 && (
                        <div className="no-cashiers">No cashiers added. Please contact admin.</div>
                      )}
                      {cashiers.map(c => (
                        <button
                          key={String(c.id || c._id || Math.random())}
                          type="button"
                          className={`cashier-card ${selectedCashierId === String(c.id || c._id || '') ? 'selected' : ''}`}
                          onClick={() => { setSelectedCashierId(String(c.id || c._id || '')); setError('') }}
                        >
                          <div className="cashier-avatar">
                            <svg width="40" height="40" viewBox="0 0 40 40">
                              <circle cx="20" cy="20" r="18" fill="#0BAD95"/>
                              <text x="20" y="24" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{(c.name||'').slice(0,2).toUpperCase()}</text>
                            </svg>
                          </div>
                          <div className="cashier-info">
                            <div className="cashier-name">{c.name}</div>
                            {c.shiftStart && c.shiftEnd && (
                              <div className="cashier-shift">{c.shiftStart} – {c.shiftEnd}</div>
                            )}
                          </div>
                          {String(selectedCashierId || '') === String(c.id || c._id || '') && (
                            <div className="cashier-check">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Password</label>
                <div className="input-wrapper">
                  <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={loginMode === 'admin' ? "Enter admin password" : "Enter cashier password"}
                    value={password}
                    onChange={e=>setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={()=>setShowPassword(v=>!v)}
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

              {error && <div className="error-message">{error}</div>}

              <button type="submit" className="submit-btn">
                {loginMode === 'admin' ? 'Admin Sign In' : 'Cashier Sign In'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Side - Illustration */}
        <div className="login-right">
          <div className="illustration-container">
            {/* Floating Food Elements */}
            <div className="floating-element burger-float">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="35" fill="#FF6B35"/>
                <ellipse cx="40" cy="35" rx="28" ry="8" fill="#8B4513"/>
                <rect x="15" y="38" width="50" height="6" rx="3" fill="#FFD700"/>
                <rect x="18" y="45" width="44" height="5" rx="2" fill="#FF6347"/>
                <ellipse cx="40" cy="52" rx="25" ry="6" fill="#D2691E"/>
                <circle cx="25" cy="30" r="3" fill="#90EE90"/>
                <circle cx="50" cy="32" r="3" fill="#90EE90"/>
                <circle cx="38" cy="28" r="2" fill="#90EE90"/>
              </svg>
            </div>

            <div className="floating-element pizza-float">
              <svg width="70" height="70" viewBox="0 0 70 70">
                <circle cx="35" cy="35" r="30" fill="#FFA500"/>
                <circle cx="35" cy="35" r="25" fill="#FFD700"/>
                <circle cx="25" cy="28" r="4" fill="#DC143C"/>
                <circle cx="45" cy="32" r="4" fill="#DC143C"/>
                <circle cx="35" cy="42" r="4" fill="#DC143C"/>
                <circle cx="30" cy="48" r="3" fill="#228B22"/>
                <circle cx="48" cy="45" r="3" fill="#228B22"/>
                <path d="M35 10 L35 35" stroke="#8B4513" strokeWidth="2"/>
              </svg>
            </div>

            <div className="floating-element fries-float">
              <svg width="60" height="70" viewBox="0 0 60 70">
                <rect x="10" y="30" width="8" height="35" rx="2" fill="#FFD700"/>
                <rect x="22" y="25" width="8" height="40" rx="2" fill="#FFD700"/>
                <rect x="34" y="28" width="8" height="37" rx="2" fill="#FFD700"/>
                <rect x="46" y="32" width="8" height="33" rx="2" fill="#FFD700"/>
                <path d="M5 65 L55 65 L50 50 L10 50 Z" fill="#DC143C"/>
              </svg>
            </div>

            <div className="floating-element drink-float">
              <svg width="55" height="70" viewBox="0 0 55 70">
                <path d="M10 15 L15 65 L40 65 L45 15 Z" fill="#87CEEB" opacity="0.8"/>
                <rect x="8" y="10" width="39" height="8" rx="2" fill="#FF6B35"/>
                <path d="M45 20 Q55 25 50 40" stroke="#FF6B35" strokeWidth="3" fill="none"/>
                <circle cx="25" cy="35" r="3" fill="white" opacity="0.6"/>
                <circle cx="32" cy="45" r="2" fill="white" opacity="0.6"/>
              </svg>
            </div>

            <div className="floating-element donut-float">
              <svg width="65" height="65" viewBox="0 0 65 65">
                <circle cx="32.5" cy="32.5" r="28" fill="#DDA0DD"/>
                <circle cx="32.5" cy="32.5" r="10" fill="#FF8C00"/>
                <circle cx="20" cy="22" r="3" fill="white"/>
                <circle cx="40" cy="25" r="2" fill="white"/>
                <circle cx="30" cy="40" r="2.5" fill="white"/>
                <circle cx="45" cy="38" r="2" fill="white"/>
                <circle cx="22" cy="45" r="2" fill="white"/>
              </svg>
            </div>

            {/* Main Content Cards */}
            <div className="content-card stats-card">
              <div className="stats-header">
                <div className="stats-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
                    <path d="M22 12A10 10 0 0 0 12 2v10z"/>
                  </svg>
                </div>
                <span>Order Analytics</span>
              </div>
              <div className="stats-value">95%</div>
              <div className="stats-label">Customer Satisfaction</div>
              <div className="progress-bar">
                <div className="progress-fill"></div>
              </div>
            </div>

            <div className="content-card notification-card">
              <div className="notification-avatar">
                <svg width="40" height="40" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="18" fill="#FF6B35"/>
                  <text x="20" y="25" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">BL</text>
                </svg>
              </div>
              <div className="notification-content">
                <div className="notification-title">New Order Received!</div>
                <div className="notification-text">Burger Combo x2 - Table 5</div>
              </div>
              <div className="notification-time">2m ago</div>
            </div>

            <div className="content-card delivery-card">
              <div className="delivery-badge">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
              </div>
              <div className="delivery-text">Fast Delivery!</div>
              <div className="delivery-sub">Average 15 mins</div>
            </div>

            {/* Decorative Elements */}
            <div className="decor-circle circle-1"></div>
            <div className="decor-circle circle-2"></div>
            <div className="decor-circle circle-3"></div>
          </div>
        </div>
      </div>
    </section>
  )
}

