import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['reprint_request','loyalty_request','low_stock','general'],
    required: true
  },
  title:        { type: String, required: true },
  message:      { type: String, required: true },
  fromUserId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  fromUserName: { type: String },
  toRole:       { type: String, default: 'Admin' },
  toUserId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status:       { type: String, enum: ['pending','approved','declined','read'], default: 'pending' },
  relatedOrderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  relatedToken:   { type: Number },
  actionedBy:     { type: String },
  actionedAt:     { type: Date },
  expiresAt:      { type: Date },
}, { timestamps: true })

notificationSchema.index({ status: 1, toRole: 1 })

export default mongoose.model('Notification', notificationSchema)
