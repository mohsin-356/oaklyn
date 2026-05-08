import { useRef } from 'react'

function safe(v) { return isNaN(v) || v == null ? 0 : Number(v); }

export default function SalarySlip({ record, onClose }) {
  const slipRef = useRef(null)

  const handlePrint = () => {
    if (!slipRef.current) return
    const content = slipRef.current.innerHTML
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <title>Salary Slip - ${record.staffName}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:ui-monospace,Menlo,Consolas,monospace;padding:16px;max-width:320px;margin:0 auto;color:#000}
        .center{text-align:center;font-weight:700}
        .row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}
        .sep{border-top:1px dashed #000;margin:8px 0}
        .bold{font-weight:700}
        .header{font-size:16px;font-weight:900;margin-bottom:4px}
        .sub{font-size:11px;color:#555}
        @media print{body{width:80mm;padding:8mm}}
      </style></head><body>${content}</body></html>`

    const w = window.open('', '_blank', 'width=400,height=600')
    if (!w) { alert('Pop-up blocked'); return }
    w.document.write(html); w.document.close()
    setTimeout(() => { w.focus(); w.print(); setTimeout(() => w.close(), 1000) }, 400)
  }

  const totalDeduct = safe(record.advanceDeduct) + safe(record.lateDeduct) + safe(record.deductions)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title">Salary Slip</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={handlePrint}>Print</button>
            <button className="btn" style={{ padding: '6px 12px', fontSize: 12 }} onClick={onClose}>Close</button>
          </div>
        </div>

        <div ref={slipRef} style={{ background: '#fafafa', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <div className="center header">OKLYNE RESTAURANT</div>
          <div className="center sub">SALARY SLIP</div>
          <div className="center sub" style={{ marginBottom: 8 }}>Period: {record.periodLabel || `${record.month}/${record.year}`}</div>

          <div className="sep"></div>

          <div className="row"><span>Name:</span><span>{record.staffName}</span></div>
          <div className="row"><span>Role:</span><span>{record.role || '-'}</span></div>
          <div className="row"><span>Joining:</span><span>{record.joiningDate ? new Date(record.joiningDate).toLocaleDateString() : '-'}</span></div>

          <div className="sep"></div>

          <div className="row"><span>Basic Salary:</span><span>Rs.{safe(record.basicSalary).toLocaleString()}</span></div>
          <div className="row"><span>Allowances:</span><span>Rs.{safe(record.allowances).toLocaleString()}</span></div>
          <div className="row"><span>Bonus:</span><span>Rs.{safe(record.bonus).toLocaleString()}</span></div>
          <div className="row"><span>Overtime:</span><span>Rs.{safe(record.overtime).toLocaleString()}</span></div>

          <div className="sep"></div>

          <div className="row bold"><span>Gross Salary:</span><span>Rs.{safe(record.grossSalary).toLocaleString()}</span></div>

          <div className="sep"></div>

          <div className="row"><span>Advance Deduct:</span><span>Rs.{safe(record.advanceDeduct).toLocaleString()}</span></div>
          <div className="row"><span>Late Deduct:</span><span>Rs.{safe(record.lateDeduct).toLocaleString()}</span></div>
          <div className="row"><span>Other Deduct:</span><span>Rs.{safe(record.deductions).toLocaleString()}</span></div>

          <div className="sep"></div>

          <div className="row bold" style={{ fontSize: 16, color: '#0BAD95' }}>
            <span>NET SALARY:</span><span>Rs.{safe(record.netSalary).toLocaleString()}</span>
          </div>

          <div className="sep"></div>

          <div className="row"><span>Payment:</span><span>{record.paymentMethod || 'Cash'} {record.paymentDate ? new Date(record.paymentDate).toLocaleDateString() : ''}</span></div>
          <div className="row"><span>Paid By:</span><span>{record.paidBy || '-'}</span></div>
        </div>
      </div>
    </div>
  )
}
