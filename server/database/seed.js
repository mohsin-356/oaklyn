import User from './models/User.js'
import Settings from './models/Settings.js'
import TokenCounter from './models/TokenCounter.js'
import MenuItem from './models/MenuItem.js'
import bcrypt from 'bcryptjs'

export async function migrateMenuItems() {
  try {
    const result = await MenuItem.updateMany(
      { image: { $exists: false } },
      { $set: { image: null } }
    )
    if (result.modifiedCount > 0) {
      console.log(`Fixed ${result.modifiedCount} menu items — added image field`)
    }
    
    const legacyResult = await MenuItem.updateMany(
      { $or: [
        { image: { $regex: '^http://' } },
        { image: { $regex: '^upload://' } },
        { image: { $regex: '^/uploads/' } }
      ]},
      { $set: { image: null } }
    )
    if (legacyResult.modifiedCount > 0) {
      console.log(`Cleared ${legacyResult.modifiedCount} legacy image URLs`)
    }
  } catch (e) {
    console.warn('Migration warning:', e.message)
  }
}

export async function seedIfEmpty() {
  try {
    const adminExists = await User.findOne({ username: 'admin' }).lean()
    if (!adminExists) {
      const hash = await bcrypt.hash('admin123', 10)
      await User.create({
        name: 'Admin',
        username: 'admin',
        passwordHash: hash,
        role: 'Admin',
        isActive: true,
      })
      console.log('Default admin created (admin / admin123)')
    } else {
      console.log('Admin already exists')
    }

    const defaultSettings = [
      { key: 'company_name', value: 'Oklyne Restaurant' },
      { key: 'company_phone', value: '+00 000 0000000' },
      { key: 'company_address', value: '123 Main Street, City' },
      { key: 'company_logo', value: '' },
      { key: 'currency_symbol', value: 'Rs.' },
      { key: 'tax_percent', value: 0 },
      { key: 'opening_time', value: '09:00' },
      { key: 'closing_time', value: '23:00' },
      { key: 'auto_day_close', value: false },
      { key: 'business_date', value: '' },
      { key: 'business_hours', value: { open: '06:00', close: '03:00' } },
      { key: 'printer_config', value: { printerName: '', enabled: false } },
      { key: 'restaurant_info', value: { name: 'Your Restaurant', address: '123 Main Street, City', phone: '+00 000 0000000', logo: '' } },
    ]
    for (const s of defaultSettings) {
      await Settings.findOneAndUpdate(
        { key: s.key },
        { $setOnInsert: { value: s.value } },
        { upsert: true, new: true }
      )
    }
    console.log('Default settings ensured')

    await TokenCounter.findOneAndUpdate(
      { name: 'default' },
      { $setOnInsert: { value: 0, lastResetDate: '' } },
      { upsert: true, new: true }
    )
  } catch (e) {
    console.warn('Seed warning:', e.message)
  }
}
