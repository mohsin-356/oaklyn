import mongoose from 'mongoose'

const reprintRequestSchema = new mongoose.Schema({
  orderId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  token:          { type: Number, required: true },
  cashierName:    { type: String },
  cashierId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName:   { type: String },
  reason:         { type: String, default: '' },
  status:         { type: String, enum: ['pending','approved','declined','expired'], default: 'pending' },
  approvedBy:     { type: String },
  approvedAt:     { type: Date },
  expiresAt:      { type: Date },
  businessDate:   { type: String },
}, { timestamps: true })

reprintRequestSchema.index({ status: 1, createdAt: -1 })

export default mongoose.model('ReprintRequest', reprintRequestSchema)
