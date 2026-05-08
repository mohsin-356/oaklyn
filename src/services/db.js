// db.js - HTTP API client for web version
// API client to communicate with backend server

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

// Safe data cleaner
const clean = (data) => {
  if (data === null || data === undefined) return data
  try {
    return JSON.parse(JSON.stringify(data))
  } catch (e) {
    return Array.isArray(data) ? [] : null
  }
}

// HTTP API caller
const apiCall = async (method, endpoint, data = null) => {
  try {
    const url = `${API_URL}${endpoint}`
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    }
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data)
    }
    const response = await fetch(url, options)
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }))
      console.warn(`[API] ${endpoint}:`, error.error)
      return null
    }
    const result = await response.json()
    return clean(result)
  } catch (e) {
    if (e.message.includes('Failed to fetch')) {
      console.warn('[API] Cannot connect to backend server. Make sure to run: npm run dev (starts both frontend and backend)')
    } else {
      console.warn(`[API] ${endpoint} failed:`, e.message)
    }
    return null
  }
}

// Build query string from filters
const buildQuery = (filters) => {
  if (!filters || Object.keys(filters).length === 0) return ''
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, typeof value === 'object' ? JSON.stringify(value) : value)
    }
  })
  return `?${params.toString()}`
}

// DB Status
export const isConnected = () => apiCall('GET', '/db/status')

// Users
export const getUsers = (filters) => apiCall('GET', `/users${buildQuery(filters)}`)
export const getUserById = (id) => apiCall('GET', `/users/${id}`)
export const createUser = (data) => apiCall('POST', '/users', data)
export const updateUser = (id, data) => apiCall('PUT', `/users/${id}`, data)
export const deleteUser = (id) => apiCall('DELETE', `/users/${id}`)
export const loginUser = (username, password, role) =>
  apiCall('POST', '/users/login', { username, password, role })
export const verifyAdminCredentials = (username, password) =>
  apiCall('POST', '/admin/verify', { username, password })

// Menu Items
export const getMenuItems = (filters) => apiCall('GET', `/menu-items${buildQuery(filters)}`)
export const getMenuItemById = (id) => apiCall('GET', `/menu-items/${id}`)
export const createMenuItem = (data) => apiCall('POST', '/menu-items', data)
export const createMenuItemsMany = (items) => apiCall('POST', '/menu-items/bulk', items)
export const updateMenuItem = (id, data) => apiCall('PUT', `/menu-items/${id}`, data)
export const deleteMenuItem = (id) => apiCall('DELETE', `/menu-items/${id}`)
export const deleteMenuItems = (filters) => apiCall('POST', '/menu-items/delete-many', filters)

// Tables
export const getTables = (filters) => apiCall('GET', `/tables${buildQuery(filters)}`)
export const getTableById = (id) => apiCall('GET', `/tables/${id}`)
export const createTable = (data) => apiCall('POST', '/tables', data)
export const updateTable = (id, data) => apiCall('PUT', `/tables/${id}`, data)
export const deleteTable = (id) => apiCall('DELETE', `/tables/${id}`)

// Orders
export const getOrders = (filters) => apiCall('GET', `/orders${buildQuery(filters)}`)
export const getOrderById = (id) => apiCall('GET', `/orders/${id}`)
export const createOrder = (data) => apiCall('POST', '/orders', data)
export const updateOrder = (id, data) => apiCall('PUT', `/orders/${id}`, data)
export const deleteOrder = (id) => apiCall('DELETE', `/orders/${id}`)
export const countOrders = (filters) => apiCall('GET', `/orders/count${buildQuery(filters)}`)

// Reservations
export const getReservations = (filters) => apiCall('GET', `/reservations${buildQuery(filters)}`)
export const getReservationById = (id) => apiCall('GET', `/reservations/${id}`)
export const createReservation = (data) => apiCall('POST', '/reservations', data)
export const updateReservation = (id, data) => apiCall('PUT', `/reservations/${id}`, data)
export const deleteReservation = (id) => apiCall('DELETE', `/reservations/${id}`)

// Inventory
export const getInventory = (filters) => apiCall('GET', `/inventory${buildQuery(filters)}`)
export const getInventoryById = (id) => apiCall('GET', `/inventory/${id}`)
export const createInventory = (data) => apiCall('POST', '/inventory', data)
export const updateInventory = (id, data) => apiCall('PUT', `/inventory/${id}`, data)
export const deleteInventory = (id) => apiCall('DELETE', `/inventory/${id}`)

// Recipes
export const getRecipes = (filters) => apiCall('GET', `/recipes${buildQuery(filters)}`)
export const getRecipeById = (id) => apiCall('GET', `/recipes/${id}`)
export const getRecipeByMenuItemId = (menuItemId) => apiCall('GET', `/recipes/by-menu-item/${menuItemId}`)
export const createRecipe = (data) => apiCall('POST', '/recipes', data)
export const updateRecipe = (id, data) => apiCall('PUT', `/recipes/${id}`, data)
export const deleteRecipe = (id) => apiCall('DELETE', `/recipes/${id}`)

// Day Sessions
export const getDaySessions = (filters) => apiCall('GET', `/day-sessions${buildQuery(filters)}`)
export const getDaySessionById = (id) => apiCall('GET', `/day-sessions/${id}`)
export const getDaySessionByDate = (date) => apiCall('GET', `/day-sessions/by-date/${date}`)
export const createDaySession = (data) => apiCall('POST', '/day-sessions', data)
export const updateDaySession = (id, data) => apiCall('PUT', `/day-sessions/${id}`, data)
export const deleteDaySession = (id) => apiCall('DELETE', `/day-sessions/${id}`)

// Refunds
export const getRefunds = (filters) => apiCall('GET', `/refunds${buildQuery(filters)}`)
export const getRefundById = (id) => apiCall('GET', `/refunds/${id}`)
export const createRefund = (data) => apiCall('POST', '/refunds', data)
export const updateRefund = (id, data) => apiCall('PUT', `/refunds/${id}`, data)
export const deleteRefund = (id) => apiCall('DELETE', `/refunds/${id}`)

// Notifications
export const getNotifications = (filters) => apiCall('GET', `/notifications${buildQuery(filters)}`)
export const getNotificationById = (id) => apiCall('GET', `/notifications/${id}`)
export const createNotification = (data) => apiCall('POST', '/notifications', data)
export const updateNotification = (id, data) => apiCall('PUT', `/notifications/${id}`, data)
export const deleteNotification = (id) => apiCall('DELETE', `/notifications/${id}`)

// Reprint Requests
export const getReprintRequests = (filters) => apiCall('GET', `/reprint-requests${buildQuery(filters)}`)
export const getReprintRequestById = (id) => apiCall('GET', `/reprint-requests/${id}`)
export const createReprintRequest = (data) => apiCall('POST', '/reprint-requests', data)
export const updateReprintRequest = (id, data) => apiCall('PUT', `/reprint-requests/${id}`, data)
export const deleteReprintRequest = (id) => apiCall('DELETE', `/reprint-requests/${id}`)
export const approveReprintRequest = (id, adminName) => apiCall('POST', `/reprint-requests/${id}/approve`, { adminName })
export const declineReprintRequest = (id, adminName) => apiCall('POST', `/reprint-requests/${id}/decline`, { adminName })

// Settings
export const getSetting = (key) => apiCall('GET', `/settings/${key}`)
export const setSetting = (key, value) => apiCall('POST', '/settings', { key, value })
export const getAllSettings = (filters) => apiCall('GET', `/settings${buildQuery(filters)}`)
export const setManySettings = (pairs) => apiCall('POST', '/settings/bulk', pairs)
export const deleteSetting = (key) => apiCall('DELETE', `/settings/${key}`)

// Token Counters
export const getTokenCounters = (filters) => apiCall('GET', `/token-counters${buildQuery(filters)}`)
export const getTokenCounterByName = (name) => apiCall('GET', `/token-counters/${name}`)
export const incrementTokenCounter = (name, bizDate) => apiCall('POST', `/token-counters/${name}/increment`, { bizDate })
export const setTokenCounter = (name, value, bizDate) => apiCall('POST', `/token-counters/${name}/set`, { value, bizDate })
export const resetTokenCounter = (name, bizDate) => apiCall('POST', `/token-counters/${name}/reset`, { bizDate })

// Bulk
export const wipeAll = () => apiCall('POST', '/wipe-all')
export const exportAll = () => apiCall('GET', '/export')
export const importAll = (data) => apiCall('POST', '/import', data)

// Staff
export const getStaff = (filters) => apiCall('GET', `/staff${buildQuery(filters)}`)
export const getStaffById = (id) => apiCall('GET', `/staff/${id}`)
export const createStaff = (data) => apiCall('POST', '/staff', data)
export const updateStaff = (id, data) => apiCall('PUT', `/staff/${id}`, data)
export const deleteStaff = (id) => apiCall('DELETE', `/staff/${id}`)
export const getStaffStats = () => apiCall('GET', '/staff/stats')

// Salary
export const getSalaryRecords = (filters) => apiCall('GET', `/salary${buildQuery(filters)}`)
export const generateSalary = (staffId, month, year) => apiCall('POST', '/salary/generate', { staffId, month, year })
export const markSalaryPaid = (id, paymentMethod, paidBy, notes) =>
  apiCall('POST', `/salary/${id}/mark-paid`, { paymentMethod, paidBy, notes })
export const updateSalary = (id, data) => apiCall('PUT', `/salary/${id}`, data)

// Advance
export const getAdvances = (filters) => apiCall('GET', `/advances${buildQuery(filters)}`)
export const createAdvance = (data) => apiCall('POST', '/advances', data)
export const approveAdvance = (id, approvedBy, deductMonth) =>
  apiCall('POST', `/advances/${id}/approve`, { approvedBy, deductMonth })
export const declineAdvance = (id) => apiCall('POST', `/advances/${id}/decline`)

// Attendance
export const getAttendance = (filters) => apiCall('GET', `/attendance${buildQuery(filters)}`)
export const markAttendance = (data) => apiCall('POST', '/attendance', data)
export const bulkMarkAttendance = (date, records) => apiCall('POST', '/attendance/bulk', { date, records })

// App
export const getUploadPort = () => 3001

// ── SAFE ARRAY HELPER ──
export const safeArray = (data) => Array.isArray(data) ? data : [];

// ─── NAMED EXPORTS for import * as db and import { orders } ───
export const users = {
  getAll: getUsers,
  getById: getUserById,
  create: createUser,
  update: updateUser,
  delete: deleteUser,
  login: loginUser,
};
export const menuItems = {
  getAll: getMenuItems,
  getById: getMenuItemById,
  create: createMenuItem,
  createMany: createMenuItemsMany,
  update: updateMenuItem,
  delete: deleteMenuItem,
  deleteMany: deleteMenuItems,
};
export const tables = {
  getAll: getTables,
  getById: getTableById,
  create: createTable,
  update: updateTable,
  delete: deleteTable,
};
export const orders = {
  getAll: getOrders,
  getById: getOrderById,
  create: createOrder,
  update: updateOrder,
  delete: deleteOrder,
  count: countOrders,
};
export const reservations = {
  getAll: getReservations,
  getById: getReservationById,
  create: createReservation,
  update: updateReservation,
  delete: deleteReservation,
};
export const inventory = {
  getAll: getInventory,
  getById: getInventoryById,
  create: createInventory,
  update: updateInventory,
  delete: deleteInventory,
};
export const recipes = {
  getAll: getRecipes,
  getById: getRecipeById,
  getByMenuItemId: getRecipeByMenuItemId,
  create: createRecipe,
  update: updateRecipe,
  delete: deleteRecipe,
};
export const daySessions = {
  getAll: getDaySessions,
  getById: getDaySessionById,
  getByDate: getDaySessionByDate,
  create: createDaySession,
  update: updateDaySession,
  delete: deleteDaySession,
};
export const refunds = {
  getAll: getRefunds,
  getById: getRefundById,
  create: createRefund,
  update: updateRefund,
  delete: deleteRefund,
};
export const notifications = {
  getAll: getNotifications,
  getById: getNotificationById,
  create: createNotification,
  update: updateNotification,
  delete: deleteNotification,
};
export const reprintRequests = {
  getAll: getReprintRequests,
  getById: getReprintRequestById,
  create: createReprintRequest,
  update: updateReprintRequest,
  delete: deleteReprintRequest,
  approve: approveReprintRequest,
  decline: declineReprintRequest,
};
export const settings = {
  getAll: getAllSettings,
  getByKey: getSetting,
  setByKey: setSetting,
  setMany: setManySettings,
  deleteByKey: deleteSetting,
};
export const tokenCounters = {
  getAll: getTokenCounters,
  getByName: getTokenCounterByName,
  increment: incrementTokenCounter,
  set: setTokenCounter,
  reset: resetTokenCounter,
};
export const bulk = {
  wipeAll,
  exportAll,
  importAll,
};
export const staff = {
  getAll: getStaff,
  getById: getStaffById,
  create: createStaff,
  update: updateStaff,
  delete: deleteStaff,
  getStats: getStaffStats,
};
export const salary = {
  getAll: getSalaryRecords,
  generate: generateSalary,
  markPaid: markSalaryPaid,
  update: updateSalary,
};
export const advance = {
  getAll: getAdvances,
  create: createAdvance,
  approve: approveAdvance,
  decline: declineAdvance,
};
export const attendance = {
  getAll: getAttendance,
  mark: markAttendance,
  bulkMark: bulkMarkAttendance,
};
export const app = {
  getUploadPort,
};

// ─── DEFAULT db OBJECT (same shape, for default import) ───
const db = {
  users: {
    getAll: getUsers,
    getById: getUserById,
    create: createUser,
    update: updateUser,
    delete: deleteUser,
    login: loginUser,
  },
  menuItems: {
    getAll: getMenuItems,
    getById: getMenuItemById,
    create: createMenuItem,
    createMany: createMenuItemsMany,
    update: updateMenuItem,
    delete: deleteMenuItem,
    deleteMany: deleteMenuItems,
  },
  tables: {
    getAll: getTables,
    getById: getTableById,
    create: createTable,
    update: updateTable,
    delete: deleteTable,
  },
  orders: {
    getAll: getOrders,
    getById: getOrderById,
    create: createOrder,
    update: updateOrder,
    delete: deleteOrder,
    count: countOrders,
  },
  reservations: {
    getAll: getReservations,
    getById: getReservationById,
    create: createReservation,
    update: updateReservation,
    delete: deleteReservation,
  },
  inventory: {
    getAll: getInventory,
    getById: getInventoryById,
    create: createInventory,
    update: updateInventory,
    delete: deleteInventory,
  },
  recipes: {
    getAll: getRecipes,
    getById: getRecipeById,
    getByMenuItemId: getRecipeByMenuItemId,
    create: createRecipe,
    update: updateRecipe,
    delete: deleteRecipe,
  },
  daySessions: {
    getAll: getDaySessions,
    getById: getDaySessionById,
    getByDate: getDaySessionByDate,
    create: createDaySession,
    update: updateDaySession,
    delete: deleteDaySession,
  },
  refunds: {
    getAll: getRefunds,
    getById: getRefundById,
    create: createRefund,
    update: updateRefund,
    delete: deleteRefund,
  },
  notifications: {
    getAll: getNotifications,
    getById: getNotificationById,
    create: createNotification,
    update: updateNotification,
    delete: deleteNotification,
  },
  reprintRequests: {
    getAll: getReprintRequests,
    getById: getReprintRequestById,
    create: createReprintRequest,
    update: updateReprintRequest,
    delete: deleteReprintRequest,
    approve: approveReprintRequest,
    decline: declineReprintRequest,
  },
  settings: {
    getAll: getAllSettings,
    getByKey: getSetting,
    setByKey: setSetting,
    setMany: setManySettings,
    deleteByKey: deleteSetting,
  },
  tokenCounters: {
    getAll: getTokenCounters,
    getByName: getTokenCounterByName,
    increment: incrementTokenCounter,
    set: setTokenCounter,
    reset: resetTokenCounter,
  },
  bulk: {
    wipeAll,
    exportAll,
    importAll,
  },
  staff: {
    getAll: getStaff,
    getById: getStaffById,
    create: createStaff,
    update: updateStaff,
    delete: deleteStaff,
    getStats: getStaffStats,
  },
  salary: {
    getAll: getSalaryRecords,
    generate: generateSalary,
    markPaid: markSalaryPaid,
    update: updateSalary,
  },
  advance: {
    getAll: getAdvances,
    create: createAdvance,
    approve: approveAdvance,
    decline: declineAdvance,
  },
  attendance: {
    getAll: getAttendance,
    mark: markAttendance,
    bulkMark: bulkMarkAttendance,
  },
  app: {
    getUploadPort,
  },
};

export default db;
