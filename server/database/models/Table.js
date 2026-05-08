import mongoose from 'mongoose'

const tableSchema = new mongoose.Schema({
  tableNumber:   { type: String, required: true, unique: true },
  number:        { type: String },
  floor:         { type: String, required: true, default: 'Ground Floor' },
  seats:         { type: Number, required: true, default: 4 },
  capacity:      { type: Number, default: 4 },
  status: {
    type: String,
    enum: ['available','occupied','reserved'],
    default: 'available'
  },
  shape:         { type: String, default: 'square' },
  currentOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  occupiedSince:  { type: Date },
}, { timestamps: true })

tableSchema.index({ tableNumber: 1 }, { unique: true })

export default mongoose.model('Table', tableSchema)
