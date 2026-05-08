import mongoose from 'mongoose'

const daySessionSchema = new mongoose.Schema({
  businessDate:   { type: String, required: true, unique: true },
  status:         { type: String, enum: ['open','closed'], default: 'open' },
  openedAt:       { type: Date },
  closedAt:       { type: Date },
  openedBy:       { type: String },
  closedBy:       { type: String },
  openingCash:    { type: Number, default: 0 },
  closingCash:    { type: Number, default: 0 },
  expectedCash:   { type: Number, default: 0 },
  cashDifference: { type: Number, default: 0 },
  totalSales:     { type: Number, default: 0 },
  totalOrders:    { type: Number, default: 0 },
  totalReturns:   { type: Number, default: 0 },
  notes:          { type: String },
  subtotal:       { type: Number, default: 0 },
  deliveryCharges:{ type: Number, default: 0 },
  gross:          { type: Number, default: 0 },
  discount:       { type: Number, default: 0 },
  net:            { type: Number, default: 0 },
  returned:       { type: Number, default: 0 },
  salesCount:     { type: Number, default: 0 },
  returnsCount:   { type: Number, default: 0 },
  tokensGenerated:{ type: Number, default: 0 },
}, { timestamps: true })

export default mongoose.model('DaySession', daySessionSchema)
