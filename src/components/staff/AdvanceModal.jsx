import { useState } from 'react'
import * as db from '../../services/db.js'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function AdvanceModal({ staff, onClose, onSaved }) {
  const [selectedStaffId, setSelectedStaffId] = useState('')
  const [amount, setAmount] = useState(0)
  const [reason, setReason] = useState('')
  const [deductMonth, setDeductMonth] = useState(() => {
    const now = new Date()
    return `${MONTHS[now.getMonth()]} ${now.getFullYear()}`
  })
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!selectedStaffId) { setError('Please select a staff member'); return }
    if (!amount || amount <= 0) { setError('Amount must be greater than 0'); return }
    setError('')
    setSaving(true)
    try {
      const s = staff.find(s => String(s._id) === String(selectedStaffId))
      const res = await db.advance.create({
        staffId: selectedStaffId,
        staffName: s?.name || '',
        amount: Number(amount),
        reason,
        deductMonth,
        notes,
        status: 'pending',
      })
      if (res?.error) { setError(res.error); setSaving(false); return }
      onSaved()
    } catch (e) { setError(e.message || 'Failed to save') }
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="card-title">Give Advance</div>

        {error && <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}

        <div className="form">
          <label className="muted" style={{ fontSize: 11 }}>Select Staff</label>
          <select className="input" value={selectedStaffId} onChange={e => setSelectedStaffId(e.target.value)}>
            <option value="">-- Select Staff --</option>
            {staff.filter(s => s.status === 'active').map(s => (
              <option key={String(s._id || s.id || Math.random())} value={String(s._id || s.id || '')}>{s.name} — {s.role}</option>
            ))}
          </select>
        </div>
        <div className="form">
          <label className="muted" style={{ fontSize: 11 }}>Amount (Rs.)</label>
          <input type="number" className="input" value={amount} onChange={e => setAmount(Number(e.target.value))} min="0" />
        </div>
        <div className="form">
          <label className="muted" style={{ fontSize: 11 }}>Reason</label>
          <input className="input" value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for advance" />
        </div>
        <div className="form">
          <label className="muted" style={{ fontSize: 11 }}>Deduct From</label>
          <select className="input" value={deductMonth} onChange={e => setDeductMonth(e.target.value)}>
            {(() => {
              const now = new Date()
              const opts = []
              for (let i = 0; i < 6; i++) {
                const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
                opts.push(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`)
              }
              return opts.map(m => <option key={m} value={m}>{m}</option>)
            })()}
          </select>
        </div>
        <div className="form">
          <label className="muted" style={{ fontSize: 11 }}>Notes</label>
          <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
        </div>

        <div className="actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Advance'}
          </button>
        </div>
      </div>
    </div>
  )
}
