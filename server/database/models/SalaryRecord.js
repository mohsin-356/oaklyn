import mongoose from 'mongoose'

const salaryRecordSchema = new mongoose.Schema({
  staffId:      {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    required: true
  },
  staffName:    { type: String, required: true },
  role:         { type: String },

  month:        { type: Number },
  year:         { type: Number },
  periodLabel:  { type: String },

  basicSalary:    { type: Number, required: true },
  allowances:     { type: Number, default: 0 },
  bonus:          { type: Number, default: 0 },
  overtime:       { type: Number, default: 0 },
  overtimeHours:  { type: Number, default: 0 },

  deductions:     { type: Number, default: 0 },
  advanceDeduct:  { type: Number, default: 0 },
  lateDeduct:     { type: Number, default: 0 },

  grossSalary:    { type: Number, required: true },
  netSalary:      { type: Number, required: true },

  paymentStatus: {
    type: String,
    enum: ['pending','paid','partial'],
    default: 'pending'
  },
  paymentDate:   { type: Date },
  paymentMethod: {
    type: String,
    enum: ['Cash','Bank Transfer','Cheque'],
    default: 'Cash'
  },
  paidBy:        { type: String },
  notes:         { type: String },

}, { timestamps: true })

export default mongoose.model('SalaryRecord', salaryRecordSchema)
