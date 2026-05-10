import mongoose from 'mongoose'

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mohsinsaeed356_db_user:Admission123@cluster0.btslrgl.mongodb.net/oaklyn_db?retryWrites=true&w=majority&appName=Cluster0'

let isConnected = false
let retryCount = 0
const MAX_RETRIES = 5
const RETRY_DELAY_MS = 3000

// Connection event logging
mongoose.connection.on('connected', () => {
  isConnected = true
  retryCount = 0
  console.log('MongoDB connected: oaklyn_db')
})

mongoose.connection.on('disconnected', () => {
  isConnected = false
  console.warn('MongoDB disconnected')
})

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message)
})

export async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) return

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    })
    isConnected = true
    retryCount = 0
  } catch (err) {
    isConnected = false
    console.error(`MongoDB connection failed (attempt ${retryCount + 1}/${MAX_RETRIES}):`, err.message)
    if (retryCount < MAX_RETRIES) {
      retryCount++
      const delay = RETRY_DELAY_MS * retryCount
      console.log(`Retrying MongoDB connection in ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
      return connectDB()
    }
    console.error('MongoDB connection failed after max retries.')
    throw err
  }
}

export async function disconnectDB() {
  if (!isConnected) return
  await mongoose.disconnect()
  isConnected = false
}

export function getIsConnected() {
  return isConnected && mongoose.connection.readyState === 1
}

export { mongoose }
