import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import { connectDB } from './database/connection.js'
import { seedIfEmpty, migrateMenuItems } from './database/seed.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3000
const API_PREFIX = '/api'

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Static files for production (only if dist exists)
import { existsSync } from 'fs'
const distPath = path.join(__dirname, '../dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
}

// Import models
import User from './database/models/User.js'
import MenuItem from './database/models/MenuItem.js'
import Order from './database/models/Order.js'
import Table from './database/models/Table.js'
import Reservation from './database/models/Reservation.js'
import Inventory from './database/models/Inventory.js'
import Recipe from './database/models/Recipe.js'
import DaySession from './database/models/DaySession.js'
import Refund from './database/models/Refund.js'
import Notification from './database/models/Notification.js'
import ReprintRequest from './database/models/ReprintRequest.js'
import Settings from './database/models/Settings.js'
import TokenCounter from './database/models/TokenCounter.js'
import Staff from './database/models/Staff.js'
import SalaryRecord from './database/models/SalaryRecord.js'
import Advance from './database/models/Advance.js'
import Attendance from './database/models/Attendance.js'
import bcrypt from 'bcryptjs'

// Helper functions
function safe(v) { return isNaN(v) || v == null ? 0 : v }

function toPlain(doc) {
  if (doc == null) return doc
  if (typeof doc !== 'object') return doc
  if (Array.isArray(doc)) return doc.map(item => toPlain(item))
  if (typeof doc.toObject === 'function') {
    try { return doc.toObject({ virtuals: false, versionKey: false, transform: false }) } catch {}
  }
  if (typeof doc.toJSON === 'function') {
    try { return doc.toJSON() } catch {}
  }
  const out = {}
  for (const key of Object.keys(doc)) {
    const val = doc[key]
    if (val == null || typeof val !== 'object') { out[key] = val; continue }
    if (val instanceof Date) { out[key] = val.toISOString(); continue }
    if (Array.isArray(val)) { out[key] = val.map(item => toPlain(item)); continue }
    out[key] = toPlain(val)
  }
  return out
}

function withStringId(doc) {
  if (!doc) return doc
  if (Array.isArray(doc)) return doc.map(withStringId)
  const id = doc._id?.toString?.() || doc._id || doc.id
  const plain = toPlain(doc)
  return { ...plain, _id: id, id }
}

// ===== API ROUTES =====

// Health check
app.get(`${API_PREFIX}/health`, async (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// DB Status
app.get(`${API_PREFIX}/db/status`, async (req, res) => {
  try {
    const isConnected = mongoose.connection.readyState === 1
    res.json({ connected: isConnected })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Fix missing toPlain export - moved here for use in connection.js if needed
export { toPlain, withStringId }

// ===== USERS =====
app.get(`${API_PREFIX}/users`, async (req, res) => {
  try {
    const users = await User.find(req.query || {}).select('-passwordHash').lean()
    res.json(withStringId(users))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/users/:id`, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash').lean()
    res.json(withStringId(user))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/users`, async (req, res) => {
  try {
    const { password, ...userData } = req.body
    const passwordHash = password ? bcrypt.hashSync(password, 10) : ''
    const user = await User.create({ ...userData, passwordHash })
    res.json(withStringId(user))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put(`${API_PREFIX}/users/:id`, async (req, res) => {
  try {
    const { password, ...updateData } = req.body
    if (password) {
      updateData.passwordHash = bcrypt.hashSync(password, 10)
    }
    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).lean()
    res.json(withStringId(user))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete(`${API_PREFIX}/users/:id`, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/users/login`, async (req, res) => {
  try {
    const { username, password, role } = req.body
    const user = await User.findOne({ username, role }).lean()
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    const valid = bcrypt.compareSync(password, user.passwordHash || '')
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })
    const { passwordHash, ...userWithoutPassword } = user
    res.json(withStringId(userWithoutPassword))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/admin/verify`, async (req, res) => {
  try {
    const { username, password } = req.body
    const admin = await User.findOne({ username, role: 'Admin' }).lean()
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' })
    const valid = bcrypt.compareSync(password, admin.passwordHash || '')
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })
    res.json({ valid: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ===== MENU ITEMS =====
app.get(`${API_PREFIX}/menu-items`, async (req, res) => {
  try {
    const items = await MenuItem.find(req.query || {}).lean()
    res.json(withStringId(items))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/menu-items/:id`, async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id).lean()
    res.json(withStringId(item))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/menu-items`, async (req, res) => {
  try {
    const item = await MenuItem.create(req.body)
    res.json(withStringId(item))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/menu-items/bulk`, async (req, res) => {
  try {
    const items = await MenuItem.insertMany(req.body)
    res.json(withStringId(items))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put(`${API_PREFIX}/menu-items/:id`, async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()
    res.json(withStringId(item))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete(`${API_PREFIX}/menu-items/:id`, async (req, res) => {
  try {
    await MenuItem.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/menu-items/delete-many`, async (req, res) => {
  try {
    await MenuItem.deleteMany(req.body || {})
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ===== TABLES =====
app.get(`${API_PREFIX}/tables`, async (req, res) => {
  try {
    const tables = await Table.find(req.query || {}).lean()
    res.json(withStringId(tables))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/tables/:id`, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id).lean()
    res.json(withStringId(table))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/tables`, async (req, res) => {
  try {
    const table = await Table.create(req.body)
    res.json(withStringId(table))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put(`${API_PREFIX}/tables/:id`, async (req, res) => {
  try {
    const table = await Table.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()
    res.json(withStringId(table))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete(`${API_PREFIX}/tables/:id`, async (req, res) => {
  try {
    await Table.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ===== ORDERS =====
app.get(`${API_PREFIX}/orders`, async (req, res) => {
  try {
    const orders = await Order.find(req.query || {}).sort({ createdAt: -1 }).lean()
    res.json(withStringId(orders))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/orders/:id`, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean()
    res.json(withStringId(order))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/orders`, async (req, res) => {
  let retryCount = 0
  const maxRetries = 3
  
  async function attemptSave(orderData) {
    try {
      const order = new Order(orderData)
      const saved = await order.save()
      return saved
    } catch (error) {
      // Check if this is a duplicate token error (E11000)
      if (error.code === 11000 && error.message && error.message.includes('token')) {
        if (retryCount >= maxRetries) {
          throw new Error('Unable to generate unique token after multiple attempts')
        }
        
        retryCount++
        console.log(`[API] Duplicate token detected: ${orderData.token}, attempting retry #${retryCount}`)
        
        // Find the next available token
        const lastOrder = await Order.findOne({}, {}, { sort: { 'token': -1 } }).lean()
        const nextToken = lastOrder && lastOrder.token ? lastOrder.token + 1 : 1
        
        console.log(`[API] Assigning new token: ${nextToken}`)
        orderData.token = nextToken
        
        // Retry with new token
        return attemptSave(orderData)
      }
      throw error
    }
  }
  
  try {
    // Normalize orderType
    const orderTypeMap = {
      'dine-in': 'Dine-In',
      'take-away': 'Take-Away',
      'delivery': 'Delivery',
      'Dine-In': 'Dine-In',
      'Take-Away': 'Take-Away',
      'Delivery': 'Delivery',
    }
    const orderData = { ...req.body }
    delete orderData._id
    delete orderData.__v
    orderData.orderType = orderTypeMap[req.body.orderType] || req.body.orderType || 'Take-Away'
    
    // Ensure token is a number
    if (orderData.token !== undefined) {
      orderData.token = Number(orderData.token)
    }
    
    // Ensure items array has all required fields
    if (Array.isArray(orderData.items)) {
      orderData.items = orderData.items.map(it => {
        const qty = Number(it.quantity || it.qty) || 1
        const price = Number(it.price) || 0
        const sub = Number(it.subtotal) || (price * qty)
        return {
          menuItemId: it.menuItemId || it.id || it._id || null,
          name: it.name || 'Item',
          price,
          quantity: qty,
          subtotal: sub,
        }
      })
    }
    
    const saved = await attemptSave(orderData)
    
    // Auto inventory deduction
    if (Array.isArray(orderData.items) && orderData.items.length > 0) {
      for (const item of orderData.items) {
        if (!item.menuItemId) continue
        const recipe = await Recipe.findOne({ menuItemId: item.menuItemId }).lean()
        if (!recipe || !Array.isArray(recipe.ingredients)) continue
        
        for (const ing of recipe.ingredients) {
          if (!ing.inventoryItemId || !ing.quantity) continue
          const deductQty = Number(ing.quantity) * Number(item.quantity || 1)
          if (deductQty <= 0) continue
          
          const updated = await Inventory.findByIdAndUpdate(
            ing.inventoryItemId,
            { $inc: { currentStock: -deductQty } },
            { new: true }
          ).lean()
          
          if (updated) {
            const minLevel = Number(updated.minLevel || updated.minStock || 0)
            if (Number(updated.currentStock) <= minLevel) {
              const newStatus = Number(updated.currentStock) <= 0 ? 'out-of-stock' : 'low-stock'
              await Inventory.findByIdAndUpdate(updated._id, { status: newStatus })
              await Notification.create({
                type: 'low_stock',
                title: `Low Stock: ${updated.name}`,
                message: `${updated.name} is ${newStatus === 'out-of-stock' ? 'OUT OF STOCK' : 'below minimum level'}. Current: ${updated.currentStock}, Min: ${minLevel}`,
                toRole: 'Admin',
                status: 'pending',
              })
            }
          }
        }
      }
    }
    
    res.json(withStringId(saved))
  } catch (e) {
    console.error('[API] Order creation error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

app.put(`${API_PREFIX}/orders/:id`, async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()
    res.json(withStringId(order))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete(`${API_PREFIX}/orders/:id`, async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/orders/last-token`, async (req, res) => {
  try {
    const lastOrder = await Order.findOne({}, {}, { sort: { 'token': -1 } }).lean()
    const lastToken = lastOrder && lastOrder.token ? lastOrder.token : 0
    res.json({ lastToken })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/orders/count`, async (req, res) => {
  try {
    const count = await Order.countDocuments(req.query || {})
    res.json({ count })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ===== RESERVATIONS =====
app.get(`${API_PREFIX}/reservations`, async (req, res) => {
  try {
    const reservations = await Reservation.find(req.query || {}).lean()
    res.json(withStringId(reservations))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/reservations/:id`, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id).lean()
    res.json(withStringId(reservation))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/reservations`, async (req, res) => {
  try {
    const reservation = await Reservation.create(req.body)
    res.json(withStringId(reservation))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put(`${API_PREFIX}/reservations/:id`, async (req, res) => {
  try {
    const reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()
    res.json(withStringId(reservation))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete(`${API_PREFIX}/reservations/:id`, async (req, res) => {
  try {
    await Reservation.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ===== INVENTORY =====
app.get(`${API_PREFIX}/inventory`, async (req, res) => {
  try {
    const inventory = await Inventory.find(req.query || {}).lean()
    res.json(withStringId(inventory))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/inventory/:id`, async (req, res) => {
  try {
    const item = await Inventory.findById(req.params.id).lean()
    res.json(withStringId(item))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/inventory`, async (req, res) => {
  try {
    const item = await Inventory.create(req.body)
    res.json(withStringId(item))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put(`${API_PREFIX}/inventory/:id`, async (req, res) => {
  try {
    const item = await Inventory.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()
    res.json(withStringId(item))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete(`${API_PREFIX}/inventory/:id`, async (req, res) => {
  try {
    await Inventory.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ===== RECIPES =====
app.get(`${API_PREFIX}/recipes`, async (req, res) => {
  try {
    const recipes = await Recipe.find(req.query || {}).lean()
    res.json(withStringId(recipes))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/recipes/:id`, async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.id).lean()
    res.json(withStringId(recipe))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/recipes/by-menu-item/:menuItemId`, async (req, res) => {
  try {
    const recipe = await Recipe.findOne({ menuItemId: req.params.menuItemId }).lean()
    res.json(withStringId(recipe))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/recipes`, async (req, res) => {
  try {
    const recipe = await Recipe.create(req.body)
    res.json(withStringId(recipe))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put(`${API_PREFIX}/recipes/:id`, async (req, res) => {
  try {
    const recipe = await Recipe.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()
    res.json(withStringId(recipe))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete(`${API_PREFIX}/recipes/:id`, async (req, res) => {
  try {
    await Recipe.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ===== DAY SESSIONS =====
app.get(`${API_PREFIX}/day-sessions`, async (req, res) => {
  try {
    const sessions = await DaySession.find(req.query || {}).lean()
    res.json(withStringId(sessions))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/day-sessions/:id`, async (req, res) => {
  try {
    const session = await DaySession.findById(req.params.id).lean()
    res.json(withStringId(session))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/day-sessions/by-date/:date`, async (req, res) => {
  try {
    const session = await DaySession.findOne({ businessDate: req.params.date }).lean()
    res.json(withStringId(session))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/day-sessions`, async (req, res) => {
  try {
    const session = await DaySession.create(req.body)
    res.json(withStringId(session))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put(`${API_PREFIX}/day-sessions/:id`, async (req, res) => {
  try {
    const session = await DaySession.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()
    res.json(withStringId(session))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete(`${API_PREFIX}/day-sessions/:id`, async (req, res) => {
  try {
    await DaySession.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ===== REFUNDS =====
app.get(`${API_PREFIX}/refunds`, async (req, res) => {
  try {
    const refunds = await Refund.find(req.query || {}).lean()
    res.json(withStringId(refunds))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/refunds/:id`, async (req, res) => {
  try {
    const refund = await Refund.findById(req.params.id).lean()
    res.json(withStringId(refund))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/refunds`, async (req, res) => {
  try {
    const refund = await Refund.create(req.body)
    res.json(withStringId(refund))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put(`${API_PREFIX}/refunds/:id`, async (req, res) => {
  try {
    const refund = await Refund.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()
    res.json(withStringId(refund))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete(`${API_PREFIX}/refunds/:id`, async (req, res) => {
  try {
    await Refund.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ===== NOTIFICATIONS =====
app.get(`${API_PREFIX}/notifications`, async (req, res) => {
  try {
    const notifications = await Notification.find(req.query || {}).sort({ createdAt: -1 }).lean()
    res.json(withStringId(notifications))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/notifications/:id`, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id).lean()
    res.json(withStringId(notification))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/notifications`, async (req, res) => {
  try {
    const notification = await Notification.create(req.body)
    res.json(withStringId(notification))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put(`${API_PREFIX}/notifications/:id`, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()
    res.json(withStringId(notification))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete(`${API_PREFIX}/notifications/:id`, async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ===== REPRINT REQUESTS =====
app.get(`${API_PREFIX}/reprint-requests`, async (req, res) => {
  try {
    const requests = await ReprintRequest.find(req.query || {}).lean()
    res.json(withStringId(requests))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/reprint-requests/:id`, async (req, res) => {
  try {
    const request = await ReprintRequest.findById(req.params.id).lean()
    res.json(withStringId(request))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/reprint-requests`, async (req, res) => {
  try {
    const request = await ReprintRequest.create(req.body)
    res.json(withStringId(request))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put(`${API_PREFIX}/reprint-requests/:id`, async (req, res) => {
  try {
    const request = await ReprintRequest.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()
    res.json(withStringId(request))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete(`${API_PREFIX}/reprint-requests/:id`, async (req, res) => {
  try {
    await ReprintRequest.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/reprint-requests/:id/approve`, async (req, res) => {
  try {
    const { adminName } = req.body
    const request = await ReprintRequest.findByIdAndUpdate(
      req.params.id,
      { status: 'approved', approvedBy: adminName, approvedAt: new Date() },
      { new: true }
    ).lean()
    res.json(withStringId(request))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/reprint-requests/:id/decline`, async (req, res) => {
  try {
    const { adminName } = req.body
    const request = await ReprintRequest.findByIdAndUpdate(
      req.params.id,
      { status: 'declined', declinedBy: adminName, declinedAt: new Date() },
      { new: true }
    ).lean()
    res.json(withStringId(request))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ===== SETTINGS =====
app.get(`${API_PREFIX}/settings`, async (req, res) => {
  try {
    const settings = await Settings.find(req.query || {}).lean()
    res.json(withStringId(settings))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/settings/:key`, async (req, res) => {
  try {
    const setting = await Settings.findOne({ key: req.params.key }).lean()
    res.json(withStringId(setting))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/settings`, async (req, res) => {
  try {
    const { key, value } = req.body
    const setting = await Settings.findOneAndUpdate(
      { key },
      { key, value },
      { upsert: true, new: true }
    ).lean()
    res.json(withStringId(setting))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/settings/bulk`, async (req, res) => {
  try {
    const pairs = req.body
    const results = []
    for (const { key, value } of pairs) {
      const setting = await Settings.findOneAndUpdate(
        { key },
        { key, value },
        { upsert: true, new: true }
      ).lean()
      results.push(withStringId(setting))
    }
    res.json(results)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete(`${API_PREFIX}/settings/:key`, async (req, res) => {
  try {
    await Settings.findOneAndDelete({ key: req.params.key })
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ===== TOKEN COUNTERS =====
app.get(`${API_PREFIX}/token-counters`, async (req, res) => {
  try {
    const counters = await TokenCounter.find(req.query || {}).lean()
    res.json(withStringId(counters))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/token-counters/:name`, async (req, res) => {
  try {
    const counter = await TokenCounter.findOne({ name: req.params.name }).lean()
    res.json(withStringId(counter))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/token-counters/:name/increment`, async (req, res) => {
  try {
    const { bizDate } = req.body
    let counter = await TokenCounter.findOne({ name: req.params.name })
    if (!counter) {
      counter = await TokenCounter.create({ name: req.params.name, value: 1, lastResetDate: bizDate })
    } else {
      counter = await TokenCounter.findOneAndUpdate(
        { name: req.params.name },
        { $inc: { value: 1 } },
        { new: true }
      )
    }
    res.json(withStringId(counter))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/token-counters/:name/set`, async (req, res) => {
  try {
    const { value, bizDate } = req.body
    const counter = await TokenCounter.findOneAndUpdate(
      { name: req.params.name },
      { value, lastResetDate: bizDate },
      { upsert: true, new: true }
    ).lean()
    res.json(withStringId(counter))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/token-counters/:name/reset`, async (req, res) => {
  try {
    const { bizDate } = req.body
    const counter = await TokenCounter.findOneAndUpdate(
      { name: req.params.name },
      { value: 0, lastResetDate: bizDate },
      { upsert: true, new: true }
    ).lean()
    res.json(withStringId(counter))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ===== STAFF =====
app.get(`${API_PREFIX}/staff`, async (req, res) => {
  try {
    const staff = await Staff.find(req.query || {}).lean()
    res.json(withStringId(staff))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/staff/:id`, async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id).lean()
    res.json(withStringId(staff))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/staff`, async (req, res) => {
  try {
    const staff = await Staff.create(req.body)
    res.json(withStringId(staff))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put(`${API_PREFIX}/staff/:id`, async (req, res) => {
  try {
    const staff = await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()
    res.json(withStringId(staff))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.delete(`${API_PREFIX}/staff/:id`, async (req, res) => {
  try {
    await Staff.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get(`${API_PREFIX}/staff/stats`, async (req, res) => {
  try {
    const stats = await Staff.aggregate([
      {
        $group: {
          _id: null,
          totalStaff: { $sum: 1 },
          activeStaff: { $sum: { $cond: [{ $eq: ['$status', 'Active'] }, 1, 0] } },
          inactiveStaff: { $sum: { $cond: [{ $eq: ['$status', 'Inactive'] }, 1, 0] } }
        }
      }
    ])
    res.json(stats[0] || { totalStaff: 0, activeStaff: 0, inactiveStaff: 0 })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ===== SALARY =====
app.get(`${API_PREFIX}/salary`, async (req, res) => {
  try {
    const records = await SalaryRecord.find(req.query || {}).populate('staffId').lean()
    res.json(withStringId(records))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/salary/generate`, async (req, res) => {
  try {
    const { staffId, month, year } = req.body
    const staff = await Staff.findById(staffId)
    if (!staff) return res.status(404).json({ error: 'Staff not found' })
    
    const record = await SalaryRecord.findOneAndUpdate(
      { staffId, month, year },
      {
        staffId,
        month,
        year,
        baseSalary: staff.baseSalary,
        finalAmount: staff.baseSalary,
        status: 'Pending'
      },
      { upsert: true, new: true }
    ).lean()
    
    res.json(withStringId(record))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/salary/:id/mark-paid`, async (req, res) => {
  try {
    const { paymentMethod, paidBy, notes } = req.body
    const record = await SalaryRecord.findByIdAndUpdate(
      req.params.id,
      {
        status: 'Paid',
        paymentMethod,
        paidBy,
        paidAt: new Date(),
        notes
      },
      { new: true }
    ).lean()
    res.json(withStringId(record))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.put(`${API_PREFIX}/salary/:id`, async (req, res) => {
  try {
    const record = await SalaryRecord.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean()
    res.json(withStringId(record))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ===== ADVANCE =====
app.get(`${API_PREFIX}/advances`, async (req, res) => {
  try {
    const advances = await Advance.find(req.query || {}).populate('staffId').lean()
    res.json(withStringId(advances))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/advances`, async (req, res) => {
  try {
    const advance = await Advance.create(req.body)
    res.json(withStringId(advance))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/advances/:id/approve`, async (req, res) => {
  try {
    const { approvedBy, deductMonth } = req.body
    const advance = await Advance.findByIdAndUpdate(
      req.params.id,
      { status: 'Approved', approvedBy, deductMonth },
      { new: true }
    ).lean()
    res.json(withStringId(advance))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/advances/:id/decline`, async (req, res) => {
  try {
    const advance = await Advance.findByIdAndUpdate(
      req.params.id,
      { status: 'Declined' },
      { new: true }
    ).lean()
    res.json(withStringId(advance))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ===== ATTENDANCE =====
app.get(`${API_PREFIX}/attendance`, async (req, res) => {
  try {
    const attendance = await Attendance.find(req.query || {}).populate('staffId').lean()
    res.json(withStringId(attendance))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/attendance`, async (req, res) => {
  try {
    const { staffId, date, status, checkIn, checkOut, notes } = req.body
    const attendance = await Attendance.findOneAndUpdate(
      { staffId, date },
      { staffId, date, status, checkIn, checkOut, notes },
      { upsert: true, new: true }
    ).lean()
    res.json(withStringId(attendance))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post(`${API_PREFIX}/attendance/bulk`, async (req, res) => {
  try {
    const { date, records } = req.body
    const results = []
    for (const { staffId, status, checkIn, checkOut, notes } of records) {
      const attendance = await Attendance.findOneAndUpdate(
        { staffId, date },
        { staffId, date, status, checkIn, checkOut, notes },
        { upsert: true, new: true }
      ).lean()
      results.push(withStringId(attendance))
    }
    res.json(results)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ===== BULK OPERATIONS =====
app.post(`${API_PREFIX}/wipe-all`, async (req, res) => {
  try {
    await Promise.all([
      User.deleteMany({}),
      MenuItem.deleteMany({}),
      Order.deleteMany({}),
      Table.deleteMany({}),
      Reservation.deleteMany({}),
      Inventory.deleteMany({}),
      Recipe.deleteMany({}),
      DaySession.deleteMany({}),
      Refund.deleteMany({}),
      Notification.deleteMany({}),
      ReprintRequest.deleteMany({}),
      Settings.deleteMany({}),
      TokenCounter.deleteMany({}),
      Staff.deleteMany({}),
      SalaryRecord.deleteMany({}),
      Advance.deleteMany({}),
      Attendance.deleteMany({})
    ])
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Catch-all for SPA routing - serve index.html for non-API routes (only if dist exists)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next()
  }
  const indexPath = path.join(__dirname, '../dist/index.html')
  if (existsSync(indexPath)) {
    res.sendFile(indexPath)
  } else {
    // Return a simple message if dist folder doesn't exist (dev mode)
    res.send(`
      <html>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>Oaklyn POS API Server</h1>
          <p>API is running at: <a href="${API_PREFIX}">${API_PREFIX}</a></p>
          <p style="color: #666; margin-top: 20px;">
            Frontend not built. Run <code>npm run build</code> to build the frontend,
            <br>or use <code>npm run dev</code> for development mode.
          </p>
        </body>
      </html>
    `)
  }
})

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDB()
    
    // Seed if empty
    await seedIfEmpty()
    await migrateMenuItems()
    
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`)
      console.log(`API available at http://localhost:${PORT}${API_PREFIX}`)
    })
  } catch (e) {
    console.error('Failed to start server:', e)
    process.exit(1)
  }
}

startServer()
