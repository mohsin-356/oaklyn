import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { listNotifications, updateNotification, approveReprintRequest, declineReprintRequest, createNotification, getCurrentUser } from '../utils/storage.js'
import { orders } from '../services/db.js'

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 360 })
  const bellRef = useRef(null)
  const panelRef = useRef(null)
  const user = getCurrentUser()
  const isAdmin = user && String(user.role || '').toLowerCase() === 'admin'

  const load = async () => {
    try {
      const all = await listNotifications({ toRole: 'Admin' })
      setNotifications(Array.isArray(all) ? all : [])
    } catch {}
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    const interval = setInterval(load, 15000)
    const onNotif = () => load()
    window.addEventListener('notifications:changed', onNotif)
    return () => { clearInterval(interval); window.removeEventListener('notifications:changed', onNotif) }
  }, [])

  useEffect(() => {
    const onDocClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) && !bellRef.current?.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const unread = notifications.filter(n => n.status === 'pending').length

  function positionPanel() {
    const btn = bellRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const vw = window.innerWidth
    const width = Math.min(360, Math.floor(vw * 0.9))
    let left = rect.right - width
    left = Math.max(8, Math.min(left, vw - width - 8))
    let top = rect.bottom + 8
    if (top + 400 > window.innerHeight) top = Math.max(8, rect.top - 400)
    setPos({ top, left, width })
  }

  const handleAction = async (notif, action) => {
    try {
      if (notif.type === 'loyalty_request') {
        if (action === 'approve') {
          await updateNotification(notif._id, { status: 'approved', actionedBy: user?.name || user?.username || 'Admin', actionedAt: new Date() })
          // Also update the order's loyaltyApproved flag
          if (notif.relatedOrderId) await orders.update(notif.relatedOrderId, { loyaltyApproved: true })
          // Create notification back to cashier
          await createNotification({
            type: 'general',
            title: 'Loyalty Reward Approved',
            message: `Admin approved loyalty reward for Token #${notif.relatedToken || '-'}`,
            toRole: 'Cashier',
            toUserId: notif.fromUserId,
            status: 'pending',
            relatedToken: notif.relatedToken,
          })
        } else {
          await updateNotification(notif._id, { status: 'declined', actionedBy: user?.name || user?.username || 'Admin', actionedAt: new Date() })
        }
      } else if (notif.type === 'reprint_request') {
        if (action === 'approve') {
          await approveReprintRequest(notif._id, user?.name || user?.username || 'Admin')
          await updateNotification(notif._id, { status: 'approved', actionedBy: user?.name || user?.username || 'Admin', actionedAt: new Date() })
          // Notify cashier
          await createNotification({
            type: 'general',
            title: 'Reprint Approved',
            message: `Admin approved reprint for Token #${notif.relatedToken || '-'}. Print within 10 minutes.`,
            toRole: 'Cashier',
            toUserId: notif.fromUserId,
            status: 'pending',
            relatedToken: notif.relatedToken,
          })
        } else {
          await declineReprintRequest(notif._id, user?.name || user?.username || 'Admin')
          await updateNotification(notif._id, { status: 'declined', actionedBy: user?.name || user?.username || 'Admin', actionedAt: new Date() })
        }
      }
      await load()
      window.dispatchEvent(new Event('notifications:changed'))
    } catch (e) { console.error('Notification action failed', e) }
  }

  const markRead = async (id) => {
    try { await updateNotification(id, { status: 'read' }); await load() } catch {}
  }

  if (!isAdmin) return null

  return (
    <>
      <button
        ref={bellRef}
        type="button"
        className="profile-btn"
        aria-label="Notifications"
        title="Notifications"
        onClick={(e) => { e.stopPropagation(); setOpen(v => { const next = !v; if (!v && next) positionPanel(); return next }) }}
        style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2, background: '#ef4444', color: '#fff',
            borderRadius: '50%', minWidth: 18, height: 18, fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px'
          }}>{unread}</span>
        )}
      </button>
      {open && createPortal(
        <div ref={panelRef} className="card" style={{
          position: 'fixed', top: pos.top, left: pos.left, width: pos.width,
          maxHeight: '80vh', overflowY: 'auto', zIndex: 99999, padding: 12
        }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
            Notifications {unread > 0 && <span style={{ color: '#ef4444', fontSize: 13 }}>({unread} unread)</span>}
          </div>
          {notifications.length === 0 && <div className="muted" style={{ padding: 12 }}>No notifications</div>}
          {notifications.map(n => (
            <div key={String(n._id || n.id || Math.random())} style={{
              padding: 10, marginBottom: 8, borderRadius: 8,
              background: n.status === 'pending' ? '#fef9c3' : n.status === 'approved' ? '#dcfce7' : n.status === 'declined' ? '#fee2e2' : '#f8fafc',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                {n.type === 'loyalty_request' ? '🏆 Loyalty Request' : n.type === 'reprint_request' ? '🖨️ Reprint Request' : 'ℹ️ Info'}
              </div>
              <div style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>{n.message}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 6 }}>
                {n.fromUserName && `From: ${n.fromUserName} • `}
                {new Date(n.createdAt).toLocaleString()}
              </div>
              {n.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" style={{ background: '#16a34a', borderColor: '#16a34a', color: '#fff', padding: '4px 12px', fontSize: 12 }}
                    onClick={() => handleAction(n, 'approve')}>Approve</button>
                  <button className="btn danger" style={{ padding: '4px 12px', fontSize: 12 }}
                    onClick={() => handleAction(n, 'decline')}>Decline</button>
                </div>
              )}
              {n.status !== 'pending' && (
                <div style={{ fontSize: 12, color: n.status === 'approved' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                  {n.status === 'approved' ? '✅ Approved' : n.status === 'declined' ? '❌ Declined' : '👁 Read'}
                  {n.actionedBy && ` by ${n.actionedBy}`}
                </div>
              )}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}
