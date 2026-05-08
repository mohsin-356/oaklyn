import mongoose from 'mongoose'

const refundSchema = new mongoose.Schema({
  orderId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  token:        { type: Number, required: true },
  customerName: { type: String },
  refundType:   { type: String, enum: ['full','partial'], default: 'full' },
  refundAmount: { type: Number, required: true },
  reason:       { type: String },
  processedBy:  { type: String },
  businessDate: { type: String },
  bizId:        { type: String },
}, { timestamps: true })

export default mongoose.model('Refund', refundSchema)
