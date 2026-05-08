import mongoose from 'mongoose'

const reservationSchema = new mongoose.Schema({
  customerName:    { type: String, required: true },
  phone:           { type: String },
  tableId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Table' },
  tableNumber:     { type: String },
  floor:           { type: String },
  guestCount:      { type: Number },
  reservationDate: { type: String, required: true },
  reservationTime: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending','confirmed','arrived','cancelled'],
    default: 'pending'
  },
  notes: { type: String },
}, { timestamps: true })

export default mongoose.model('Reservation', reservationSchema)
