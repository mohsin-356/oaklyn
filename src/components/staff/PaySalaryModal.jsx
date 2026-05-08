import { useState } from 'react'

function safe(v) { return isNaN(v) || v == null ? 0 : Number(v); }

export default function PaySalaryModal({ record, onClose, onPaid }) {
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [paidBy, setPaidBy] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handlePay = async () => {
    setSaving(true)
    try {
      await onPaid(record._id, paymentMethod, paidBy, notes)
    } catch {}
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="card-title">Pay Salary</div>

        <div style={{ background: '#f0fdf4', padding: 16, borderRadius: 8, textAlign: 'center', marginBottom: 12 }}>
          <div className="muted" style={{ fontSize: 12 }}>Confirm payment to</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{record.staffName}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0BAD95', marginTop: 4 }}>Rs.{safe(record.netSalary).toLocaleString()}</div>
        </div>

        <div className="form">
          <label className="muted" style={{ fontSize: 11 }}>Payment Method</label>
          <select className="input" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cheque">Cheque</option>
          </select>
        </div>
        <div className="form">
          <label className="muted" style={{ fontSize: 11 }}>Paid By (Admin Name)</label>
          <input className="input" value={paidBy} onChange={e => setPaidBy(e.target.value)} placeholder="Enter admin name" />
        </div>
        <div className="form">
          <label className="muted" style={{ fontSize: 11 }}>Notes</label>
          <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />
        </div>

        <div className="actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handlePay} disabled={saving}>
            {saving ? 'Processing...' : 'Confirm Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
