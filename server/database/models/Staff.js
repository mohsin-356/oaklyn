import mongoose from 'mongoose'

const staffSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  fatherName:    { type: String },
  phone:         { type: String },
  cnic:          { type: String },
  address:       { type: String },
  joiningDate:   { type: Date, required: true },
  profilePhoto:  { type: String },

  role: {
    type: String,
    enum: [
      'Admin', 'Manager', 'Cashier',
      'Waiter', 'Chef', 'Receptionist',
      'Sweeper', 'Guard', 'Delivery', 'Other'
    ],
    required: true
  },
  department: {
    type: String,
    enum: ['Management','Kitchen','Service','Operations','Other'],
  },
  customRole:   { type: String },

  hasSystemAccess: { type: Boolean, default: false },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  salaryType: {
    type: String,
    enum: ['monthly','daily','hourly'],
    default: 'monthly'
  },
  salaryAmount:  { type: Number, required: true, default: 0 },
  baseSalary:    { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['active','inactive','terminated'],
    default: 'active'
  },
  terminationDate:   { type: Date },
  terminationReason: { type: String },

}, { timestamps: true })

export default mongoose.model('Staff', staffSchema)
