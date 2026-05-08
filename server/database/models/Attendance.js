import mongoose from 'mongoose'

const attendanceSchema = new mongoose.Schema({
  staffId:      {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff'
  },
  staffName:    { type: String },
  date:         { type: String, required: true },
  status: {
    type: String,
    enum: ['present','absent','late','half-day','leave'],
    default: 'present'
  },
  checkIn:      { type: String },
  checkOut:     { type: String },
  hoursWorked:  { type: Number, default: 0 },
  overtimeHours:{ type: Number, default: 0 },
  notes:        { type: String },
}, { timestamps: true })

attendanceSchema.index({ staffId: 1, date: 1 }, { unique: true })

export default mongoose.model('Attendance', attendanceSchema)
