import app from '../server/index.js'
import { connectDB } from '../server/database/connection.js'
import { seedIfEmpty, migrateMenuItems } from '../server/database/seed.js'

let dbInitialized = false

export default async function handler(req, res) {
  // Initialize DB connection on first request (cold start)
  if (!dbInitialized) {
    try {
      await connectDB()
      await seedIfEmpty()
      await migrateMenuItems()
      dbInitialized = true
    } catch (err) {
      console.error('[Vercel] DB init failed:', err.message)
      return res.status(500).json({ error: 'Database connection failed' })
    }
  }

  // Let Express handle the request
  return app(req, res)
}
