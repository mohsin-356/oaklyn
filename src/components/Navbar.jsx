import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getRestaurantInfo, getCurrentUser } from '../utils/storage.js'
import NotificationBell from './NotificationBell.jsx'
import OaklynLogo from '../../img/Oaklyn.jpg'

export default function Navbar() {
  const [brand, setBrand] = useState(() => (getRestaurantInfo().name || 'Oaklyn'))
  const [isCashier, setIsCashier] = useState(() => {
    try { return String(getCurrentUser()?.role||'').toLowerCase() === 'cashier' } catch { return false }
  })
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 280 })
  const [dayMenuOpen, setDayMenuOpen] = useState(false)
  const [dayMenuPos, setDayMenuPos] = useState({ top: 0, left: 0, width: 200 })
  const [showPwd, setShowPwd] = useState(false)
  const menuRef = useRef(null)
  const profileBtnRef = useRef(null)
  const dayMenuRef = useRef(null)
  const dayBtnRef = useRef(null)
  const nav = useNavigate()

  useEffect(() => {
    const update = () => setBrand(getRestaurantInfo().name || 'Oaklyn')
    update()
    window.addEventListener('restaurantInfo:updated', update)
    return () => window.removeEventListener('restaurantInfo:updated', update)
  }, [])


  useEffect(() => {
    // Update role on mount and when storage changes (simple polling event)
    const updateRole = () => {
      try { setIsCashier(String(getCurrentUser()?.role||'').toLowerCase() === 'cashier') } catch { setIsCashier(false) }
    }
    updateRole()
    window.addEventListener('storage', updateRole)
    return () => window.removeEventListener('storage', updateRole)
  }, [])

  useEffect(() => {
    const onDocClick = (e) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target) && !profileBtnRef.current?.contains(e.target)) setOpen(false)
    }
    const onResize = () => {
      if (!open) return
      positionProfileMenu()
    }
    if (open) {
      document.addEventListener('mousedown', onDocClick)
      window.addEventListener('resize', onResize)
      window.addEventListener('scroll', onResize, true)
    }
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open])

  function positionProfileMenu(){
    try {
      const btn = profileBtnRef.current
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const desiredWidth = 300
      const margin = 8
      const viewportW = window.innerWidth || document.documentElement.clientWidth
      const viewportH = window.innerHeight || document.documentElement.clientHeight
      const width = Math.min(desiredWidth, Math.max(240, Math.floor(viewportW * 0.92)))
      let left = rect.right - width // align right edges
      left = Math.max(margin, Math.min(left, viewportW - width - margin))
      let top = rect.bottom + margin
      // If not enough space below, open above
      if (top + 200 > viewportH && rect.top > 260) {
        top = Math.max(margin, rect.top - 240) // approximate height
      }
      setMenuPos({ top, left, width })
    } catch {}
  }

  useEffect(() => {
    const onDocClick = (e) => {
      if (!dayMenuRef.current) return
      if (!dayMenuRef.current.contains(e.target) && !dayBtnRef.current?.contains(e.target)) setDayMenuOpen(false)
    }
    const onResize = () => { if (dayMenuOpen) positionDayMenu() }
    if (dayMenuOpen) {
      document.addEventListener('mousedown', onDocClick)
      window.addEventListener('resize', onResize)
      window.addEventListener('scroll', onResize, true)
    }
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [dayMenuOpen])

  function positionDayMenu(){
    try {
      const btn = dayBtnRef.current
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const desiredWidth = 220
      const margin = 8
      const vw = window.innerWidth || document.documentElement.clientWidth
      const vh = window.innerHeight || document.documentElement.clientHeight
      const width = Math.min(desiredWidth, Math.max(160, Math.floor(vw * 0.9)))
      let left = rect.left // align left
      left = Math.max(margin, Math.min(left, vw - width - margin))
      let top = rect.bottom + margin
      if (top + 160 > vh && rect.top > 180) { // open upward if near bottom
        top = Math.max(margin, rect.top - 180)
      }
      setDayMenuPos({ top, left, width })
    } catch {}
  }

  const user = getCurrentUser() || { role: '-', username: '-', password: '' }

  const navItems = [
    { to: "/", icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>
    ), label: "Dashboard", end: true },
    { to: "/orders", icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
        <polyline points="13 2 13 9 20 9"/>
      </svg>
    ), label: "Order" },
    { to: "/tables", icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18"/>
        <path d="M9 21V9"/>
      </svg>
    ), label: "Table" },
    { to: "/sales", icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ), label: "Orders" },
    { to: "/reports", icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M3 3v18h18"/>
        <path d="M18 17V9"/>
        <path d="M13 17V5"/>
        <path d="M8 17v-3"/>
      </svg>
    ), label: "Reports" },
    { to: "/inventory", icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ), label: "Inventory" },
  ]

  const adminNavItems = [
    { to: "/add-items", icon: (
      <svg width="16" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    ), label: "Add Items" },
    { to: "/recipes", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
    ), label: "Recipes" },
    { to: "/staff", icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ), label: "Staff" },
  ]

  // Profile menu items (secondary actions)
  const profileMenuItems = [
    { to: "/settings", icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ), label: "Settings" },
    { to: "/returns", icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="9 14 4 9 9 4"/>
        <path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
      </svg>
    ), label: "Refund" },
  ]

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <div className="brand-logo-small">
          <img 
            src={OaklynLogo} 
            alt="Oaklyn" 
            style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
            onError={(e) => {
              e.target.style.display = 'none'
            }}
          />
        </div>
        <span className="brand-text" style={{ 
          fontSize: 20, 
          fontWeight: 800, 
          color: '#0BAD95',
          letterSpacing: '-0.5px',
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif'
        }}>Oaklyn</span>
      </div>
      
      <nav className="navbar-nav">
        {isCashier ? (
          <>
            <NavLink to="/orders" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                <polyline points="13 2 13 9 20 9"/>
              </svg>
              <span>Order</span>
            </NavLink>
            <NavLink to="/pos" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span>POS</span>
            </NavLink>
            <NavLink to="/recent-sales" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>Orders</span>
            </NavLink>
          </>
        ) : (
          <>
            {navItems.map(item => (
              <NavLink 
                key={item.to}
                to={item.to} 
                end={item.end}
                className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
            <div className="nav-divider"></div>
            {adminNavItems.map(item => (
              <NavLink 
                key={item.to}
                to={item.to}
                className={({isActive}) => `nav-item nav-item-small ${isActive ? 'active' : ''}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
            <div className="nav-item nav-item-dropdown" ref={dayBtnRef}>
              <button 
                type="button" 
                className="day-menu-btn"
                onClick={(e)=>{ e.stopPropagation(); setDayMenuOpen(v=>{ const next = !v; if (!v && next) positionDayMenu(); return next }) }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                <span>Day</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`dropdown-arrow ${dayMenuOpen ? 'open' : ''}`}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
              {dayMenuOpen && createPortal(
                <div
                  ref={dayMenuRef}
                  className="day-dropdown"
                  style={{ position:'fixed', top:dayMenuPos.top, left:dayMenuPos.left, width:dayMenuPos.width, maxWidth:'92vw', zIndex:99999 }}
                >
                  <button className="day-dropdown-item" onClick={()=>{ setDayMenuOpen(false); nav('/day-open') }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    Day Open
                  </button>
                  <button className="day-dropdown-item" onClick={()=>{ setDayMenuOpen(false); nav('/day-close') }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                    Day Close
                  </button>
                </div>,
                document.body
              )}
            </div>
          </>
        )}

        {/* Notification Bell (Admin only) */}
        <NotificationBell />
        {/* Profile button */}
        <div className="nav-profile">
          <button 
            ref={profileBtnRef} 
            type="button" 
            className="profile-btn"
            aria-label="Profile" 
            title="Profile"
            onClick={(e)=>{ e.stopPropagation(); setOpen(o=>{ const next = !o; if (!o && !next) return next; if (!o && next) positionProfileMenu(); return next }) }}
          >
            <div className="profile-avatar">
              {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
            </div>
          </button>
          {open && createPortal(
            <div ref={menuRef} className="card profile-dropdown" style={{position:'fixed', top:menuPos.top, left:menuPos.left, width:menuPos.width, maxWidth:'92vw', padding:12, zIndex:99999}}>
              <div className="card-title" style={{display:'flex', alignItems:'center', gap:8, marginBottom:12}}>
                <span>Profile</span>
              </div>
              <div className="row" style={{justifyContent:'space-between'}}><div className="muted">Role</div><div><b>{user.role||'-'}</b></div></div>
              <div className="row" style={{justifyContent:'space-between'}}><div className="muted">Username</div><div><b>{user.username||'-'}</b></div></div>
              <div className="form" style={{marginTop:8}}>
                <label className="muted" style={{display:'block', marginBottom:4}}>Password</label>
                <div className="input-wrap">
                  <input
                    className="input"
                    type={showPwd ? 'text' : 'password'}
                    value={user.password || ''}
                    readOnly
                    placeholder="-"
                    style={{paddingRight:36}}
                  />
                  <button
                    type="button"
                    className="input-icon-btn eye-toggle"
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                    title={showPwd ? 'Hide password' : 'Show password'}
                    onClick={()=>setShowPwd(v=>!v)}
                  >
                    {showPwd ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-5 0-9.27-3.11-11-8 1.02-2.78 2.86-5.06 5.12-6.56"/>
                        <path d="M1 1l22 22"/>
                        <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24"/>
                        <path d="M10.73 5.08A10.94 10.94 0 0 1 12 4c5 0 9.27 3.11 11 8a11.28 11.28 0 0 1-2.16 3.19"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              
              {/* Profile Menu Links */}
              <div className="profile-menu-links" style={{marginTop:12, borderTop:'1px solid #e2e8f0', paddingTop:12}}>
                {profileMenuItems.map(item => (
                  <button
                    key={item.to}
                    className="profile-menu-item"
                    onClick={()=>{ setOpen(false); nav(item.to) }}
                    style={{display:'flex', alignItems:'center', gap:10, width:'100%', padding:'10px 12px', border:'none', background:'none', cursor:'pointer', borderRadius:8, marginBottom:4}}
                  >
                    {item.icon}
                    <span style={{fontSize:14, fontWeight:500, color:'#475569'}}>{item.label}</span>
                  </button>
                ))}
              </div>
              
              <div className="actions" style={{justifyContent:'flex-end', marginTop:12, paddingTop:12, borderTop:'1px solid #e2e8f0'}}>
                <button className="btn danger" onClick={()=>{ setOpen(false); nav('/logout') }}>Logout</button>
              </div>
            </div>,
            document.body
          )}
        </div>
      </nav>
    </header>
  )
}
