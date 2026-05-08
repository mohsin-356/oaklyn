import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveSession, saveCustomSession, isSuperAdminAuthenticated } from '../utils/jwtAuth.js'
import OaklynLogo from '../../img/Oaklyn.jpg'

export default function SessionSelector() {
  const [selectedSession, setSelectedSession] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const [customUnit, setCustomUnit] = useState('hours')
  const nav = useNavigate()

  // Check if super admin is authenticated
  if (!isSuperAdminAuthenticated()) {
    nav('/super-admin')
    return null
  }

  const predefinedSessions = [
    { id: '1minute', label: '1 Minute', duration: 'Demo mode', color: '#FF6B6B', icon: 'clock' },
    { id: '3days', label: '3 Days', duration: '72 hours', color: '#4ECDC4', icon: 'calendar' },
    { id: '1month', label: '1 Month', duration: '30 days', color: '#45B7D1', icon: 'month' },
    { id: 'lifetime', label: 'Lifetime', duration: 'Unlimited', color: '#96CEB4', icon: 'star' },
    { id: 'custom', label: 'Custom', duration: 'Set your own', color: '#9F7AEA', icon: 'settings' }
  ]

  const handleContinue = async () => {
    if (!selectedSession) return

    if (selectedSession === 'custom') {
      setShowCustomForm(true)
      return
    }

    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    saveSession(selectedSession)
    setIsLoading(false)
    nav('/login')
  }

  const handleCustomSave = async () => {
    if (!customValue || parseInt(customValue) <= 0) return

    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    const durationMs = customUnit === 'hours' 
      ? parseInt(customValue) * 60 * 60 * 1000
      : parseInt(customValue) * 24 * 60 * 60 * 1000
    
    saveCustomSession(durationMs)
    setIsLoading(false)
    nav('/login')
  }

  const getSessionIcon = (icon) => {
    const icons = {
      clock: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>,
      calendar: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
      month: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/></svg>,
      star: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
      settings: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m11-7h-6m-6 0H1m20.07-4.93l-4.24 4.24M7.17 13.83l-4.24 4.24m18.14-4.24l-4.24-4.24M7.17 10.17L2.93 5.93"/></svg>
    }
    return icons[icon] || icons.clock
  }

  if (showCustomForm) {
    return (
      <section className="login-page">
        <div className="login-container">
          <div className="login-left" style={{ maxWidth: '500px' }}>
            <div className="login-header">
              <div className="brand-logo">
                <img src={OaklynLogo} alt="Oaklyn" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none' }} />
                <span className="brand-name">Oaklyn POS</span>
              </div>
            </div>

            <div className="login-form-wrapper">
              <div className="login-badge" style={{ background: 'linear-gradient(135deg, #9F7AEA 0%, #667eea 100%)', color: 'white', padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px', display: 'inline-block' }}>
                Custom Duration
              </div>

              <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', color: '#1a202c' }}>
                Set Custom Session Time
              </h2>
              <p style={{ fontSize: '14px', color: '#718096', marginBottom: '24px' }}>
                Enter how long you want the session to last
              </p>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#4A5568', marginBottom: '8px' }}>Duration</label>
                  <input
                    type="number"
                    min="1"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    placeholder="Enter number"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #E2E8F0',
                      borderRadius: '10px',
                      fontSize: '16px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#4A5568', marginBottom: '8px' }}>Unit</label>
                  <select
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #E2E8F0',
                      borderRadius: '10px',
                      fontSize: '16px',
                      outline: 'none',
                      background: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>

              {customValue && parseInt(customValue) > 0 && (
                <div style={{
                  background: '#F7FAFC',
                  padding: '16px',
                  borderRadius: '10px',
                  marginBottom: '24px',
                  border: '2px solid #9F7AEA'
                }}>
                  <div style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>Session will expire in:</div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#9F7AEA' }}>
                    {customValue} {customUnit}
                  </div>
                </div>
              )}

              <button 
                onClick={handleCustomSave}
                className="submit-btn"
                disabled={!customValue || parseInt(customValue) <= 0 || isLoading}
                style={{ 
                  opacity: (!customValue || parseInt(customValue) <= 0 || isLoading) ? 0.7 : 1,
                  cursor: (!customValue || parseInt(customValue) <= 0 || isLoading) ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, #9F7AEA 0%, #667eea 100%)'
                }}
              >
                {isLoading ? 'Setting up...' : 'Set Custom Duration'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCustomForm(false)
                  setSelectedSession('')
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
                Back to Options
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="login-page">
      <div className="login-container">
        <div className="login-left" style={{ maxWidth: '600px' }}>
          <div className="login-header">
            <div className="brand-logo">
              <img src={OaklynLogo} alt="Oaklyn" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none' }} />
              <span className="brand-name">Oaklyn POS</span>
            </div>
          </div>

          <div className="login-form-wrapper">
            <div className="login-badge" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: 'white', padding: '8px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '20px', display: 'inline-block' }}>
              Session Configuration
            </div>

            <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px', color: '#1a202c' }}>
              Select Session Duration
            </h2>
            <p style={{ fontSize: '14px', color: '#718096', marginBottom: '32px' }}>
              Choose how long you want the software to remain active
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '32px' }}>
              {predefinedSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setSelectedSession(session.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px 12px',
                    border: `2px solid ${selectedSession === session.id ? session.color : '#E2E8F0'}`,
                    borderRadius: '12px',
                    background: selectedSession === session.id ? `${session.color}15` : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: selectedSession === session.id ? `0 4px 15px ${session.color}40` : '0 2px 8px rgba(0,0,0,0.04)',
                    position: 'relative'
                  }}
                >
                  <div style={{ color: session.color, marginBottom: '8px' }}>
                    {getSessionIcon(session.icon)}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a202c', marginBottom: '2px' }}>
                    {session.label}
                  </div>
                  <div style={{ fontSize: '11px', color: '#718096' }}>
                    {session.duration}
                  </div>
                  {selectedSession === session.id && (
                    <div style={{
                      position: 'absolute',
                      top: '6px',
                      right: '6px',
                      width: '18px',
                      height: '18px',
                      background: session.color,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20,6 9,17 4,12"/>
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>

            <button 
              onClick={handleContinue}
              className="submit-btn"
              disabled={!selectedSession || isLoading}
              style={{ 
                opacity: (!selectedSession || isLoading) ? 0.7 : 1,
                cursor: (!selectedSession || isLoading) ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? 'Setting up...' : (selectedSession === 'custom' ? 'Set Custom Duration' : 'Continue to Company Login')}
            </button>

            <button
              type="button"
              onClick={() => nav('/super-admin')}
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
              Back to Super Admin
            </button>
          </div>
        </div>

        <div className="login-right">
          <div className="illustration-container">
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
              <div style={{ width: '180px', height: '180px', background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 20px 60px rgba(17, 153, 142, 0.4)' }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12,6 12,12 16,14"/>
                </svg>
              </div>
              <h3 style={{ fontSize: '24px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>Session Active</h3>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', maxWidth: '250px', margin: '0 auto' }}>
                Software will remain active for the selected duration
              </p>
            </div>

            {selectedSession && (
              <div style={{ position: 'absolute', bottom: '15%', left: '50%', transform: 'translateX(-50%)', background: 'white', padding: '12px 24px', borderRadius: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '12px', height: '12px', background: '#38ef7d', borderRadius: '50%', animation: 'pulse 2s infinite' }}/>
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#1a202c' }}>
                  {predefinedSessions.find(s => s.id === selectedSession)?.duration} selected
                </span>
              </div>
            )}

            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
          </div>
        </div>
      </div>
    </section>
  )
}
