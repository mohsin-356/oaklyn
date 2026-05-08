import mongoose from 'mongoose'

const orderItemSchema = new mongoose.Schema({
  menuItemId:  { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  name:        { type: String, required: true },
  price:       { type: Number, required: true, default: 0 },
  quantity:    { type: Number, required: true, default: 1 },
  subtotal:    { type: Number, required: true, default: 0 },
})

const orderSchema = new mongoose.Schema({
  token:       { type: Number, required: true, unique: true },
  orderType: {
    type: String,
    enum: ['Dine-In','Take-Away','Delivery'],
    required: true
  },
  tableNumber:   { type: String },
  customerName:  { type: String, default: 'Walk-in' },
  items:         [orderItemSchema],
  subtotal:      { type: Number, required: true },
  discountType:    { type: String, enum: ['percent','fixed','none'], default: 'none' },
  discountValue:   { type: Number, default: 0 },
  discountPercent: { type: Number, default: 0 },
  discountAmount:  { type: Number, default: 0 },
  taxPercent:    { type: Number, default: 0 },
  taxAmount:     { type: Number, default: 0 },
  total:         { type: Number, required: true },
  cashierName:   { type: String },
  cashierId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  waiterName:    { type: String },
  waiterId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  waiterRole:    { type: String },
  status: {
    type: String,
    enum: ['pending','completed','refunded','cancelled'],
    default: 'pending'
  },
  isLoyaltyBill:     { type: Boolean, default: false },
  loyaltyApproved:   { type: Boolean, default: false },
  loyaltyRequestId:  { type: mongoose.Schema.Types.ObjectId },
  reprintApprovedAt: { type: Date },
  businessDate:      { type: String, required: true },
  paymentMethod:     { type: String, enum: ['Cash','Card','Online'], default: 'Cash' },
  deliveryCharges:   { type: Number, default: 0 },
  bizId:             { type: String },
}, { timestamps: true })

orderSchema.index({ businessDate: 1, token: 1, status: 1 })

export default mongoose.model('Order', orderSchema)
