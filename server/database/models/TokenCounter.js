import mongoose from 'mongoose'

const tokenCounterSchema = new mongoose.Schema({
  name:         { type: String, required: true, unique: true },
  currentValue: { type: Number, required: true, default: 0 },
  lastValue:     { type: Number, default: 0 },
  businessDate:  { type: String },
}, { timestamps: true })

export default mongoose.model('TokenCounter', tokenCounterSchema)
