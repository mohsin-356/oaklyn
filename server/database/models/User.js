import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true },
  username:     { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  password:     { type: String },
  role: {
    type: String,
    enum: ['Admin','Manager','Cashier','Waiter','Chef','Receptionist','Sweeper'],
    required: true
  },
  isActive:     { type: Boolean, default: true },
  lastLogin:    { type: Date },
}, { timestamps: true })

export default mongoose.model('User', userSchema)
