import { useState } from 'react'
import * as db from '../../services/db.js'

function safe(v) { return isNaN(v) || v == null ? 0 : Number(v); }

const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December']

export default function GenerateSalaryModal({ staff, month, year, onClose, onGenerated }) {
  const [allowances, setAllowances] = useState(0)
  const [bonus, setBonus] = useState(0)
  const [overtimeHours, setOvertimeHours] = useState(0)
  const [overtimeRate, setOvertimeRate] = useState(0)
  const [lateDeduct, setLateDeduct] = useState(0)
  const [otherDeduct, setOtherDeduct] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const basicSalary = safe(staff?.salaryAmount)
  const overtimeAmt = safe(overtimeHours) * safe(overtimeRate)
  const grossSalary = basicSalary + safe(allowances) + safe(bonus) + overtimeAmt
  const totalDeduct = safe(lateDeduct) + safe(otherDeduct)
  const netSalary = Math.max(0, grossSalary - totalDeduct)

  const handleGenerate = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await db.salary.generate(staff._id, month, year)
      if (res?.error) { setError(res.error); setSaving(false); return }
      // If we have adjustments, update the generated record
      if (res && (safe(allowances) || safe(bonus) || overtimeAmt || safe(lateDeduct) || safe(otherDeduct))) {
        await db.salary.update(res._id, {
          basicSalary,
          allowances: safe(allowances),
          bonus: safe(bonus),
          overtime: overtimeAmt,
          overtimeHours: safe(overtimeHours),
          lateDeduct: safe(lateDeduct),
          deductions: safe(otherDeduct),
        })
      }
      onGenerated()
    } catch (e) { setError(e.message || 'Failed to generate') }
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="card-title">Generate Salary</div>

        <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <div style={{ fontWeight: 600 }}>{staff?.name} — {staff?.role}</div>
          <div className="muted" style={{ fontSize: 12 }}>Period: {MONTHS[month]} {year}</div>
        </div>

        {error && <div style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}

        <div style={{ fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>Basic Salary:</span><span style={{ fontWeight: 600 }}>Rs.{basicSalary.toLocaleString()}</span>
          </div>

          <div className="form" style={{ marginTop: 8 }}><label className="muted" style={{ fontSize: 11 }}>+ Allowances</label>
            <input type="number" className="input" value={allowances} onChange={e => setAllowances(Number(e.target.value))} min="0" /></div>
          <div className="form"><label className="muted" style={{ fontSize: 11 }}>+ Bonus</label>
            <input type="number" className="input" value={bonus} onChange={e => setBonus(Number(e.target.value))} min="0" /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div className="form"><label className="muted" style={{ fontSize: 11 }}>OT Hours</label>
              <input type="number" className="input" value={overtimeHours} onChange={e => setOvertimeHours(Number(e.target.value))} min="0" /></div>
            <div className="form"><label className="muted" style={{ fontSize: 11 }}>OT Rate/hr</label>
              <input type="number" className="input" value={overtimeRate} onChange={e => setOvertimeRate(Number(e.target.value))} min="0" /></div>
          </div>

          <div style={{ borderTop: '1px dashed #e2e8f0', margin: '8px 0', paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
              <span>Gross Salary:</span><span>Rs.{grossSalary.toLocaleString()}</span>
            </div>
          </div>

          <div className="form"><label className="muted" style={{ fontSize: 11 }}>- Late Deductions</label>
            <input type="number" className="input" value={lateDeduct} onChange={e => setLateDeduct(Number(e.target.value))} min="0" /></div>
          <div className="form"><label className="muted" style={{ fontSize: 11 }}>- Other Deductions</label>
            <input type="number" className="input" value={otherDeduct} onChange={e => setOtherDeduct(Number(e.target.value))} min="0" /></div>

          <div style={{ borderTop: '2px solid #0BAD95', margin: '8px 0', paddingTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 700, color: '#0BAD95' }}>
              <span>NET SALARY:</span><span>Rs.{netSalary.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleGenerate} disabled={saving}>
            {saving ? 'Generating...' : 'Generate Salary'}
          </button>
        </div>
      </div>
    </div>
  )
}
