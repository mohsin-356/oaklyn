import mongoose from 'mongoose'

const menuItemSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  category: {
    type: String,
    enum: ['Food','Deals','Drinks','Extras'],
    required: true
  },
  subcategory: { type: String },
  type:        { type: String },
  description: { type: String },
  price:       { type: Number, required: true },
  taxPercent:  { type: Number, default: 0 },
  image:       { type: String },
  isAvailable: { type: Boolean, default: true },
}, { timestamps: true })

export default mongoose.model('MenuItem', menuItemSchema)
