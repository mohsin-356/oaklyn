import mongoose from 'mongoose'

const advanceSchema = new mongoose.Schema({
  staffId:     {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  staffName:   { type: String },
  amount:      { type: Number, required: true },
  reason:      { type: String },
  requestDate: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['pending','approved','declined','deducted'],
    default: 'pending'
  },
  approvedBy:  { type: String },
  deductMonth: { type: String },
  notes:       { type: String },
}, { timestamps: true })

export default mongoose.model('Advance', advanceSchema)
