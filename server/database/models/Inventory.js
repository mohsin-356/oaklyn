import mongoose from 'mongoose'

const inventorySchema = new mongoose.Schema({
  name:         { type: String, required: true },
  category: {
    type: String,
    enum: ['Raw Materials','Beverages','Packaging','Cleaning','Other','Food','Supplies','Equipment','All'],
    default: 'Raw Materials'
  },
  supplier:     { type: String },
  unit:         { type: String, required: true, default: 'pcs' },
  currentStock: { type: Number, required: true, default: 0 },
  quantity:     { type: Number, default: 0 },
  minLevel:     { type: Number, required: true, default: 0 },
  minStock:     { type: Number, default: 0 },
  maxStock:     { type: Number, default: 100 },
  pricePerUnit: { type: Number, default: 0 },
  costPrice:    { type: Number, default: 0 },
  isActive:     { type: Boolean, default: true },
  status:       { type: String, enum: ['in-stock','low-stock','out-of-stock'], default: 'in-stock' },
}, { timestamps: true })

inventorySchema.index({ category: 1, currentStock: 1 })

export default mongoose.model('Inventory', inventorySchema)
