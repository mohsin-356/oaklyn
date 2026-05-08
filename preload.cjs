const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('burgerPos', {
  getMachineId: () => ipcRenderer.invoke('license:machineId'),
  activate: (key) => ipcRenderer.invoke('license:activate', key),
  storeGetSync: (key) => ipcRenderer.sendSync('store:getSync', key),
  storeSetSync: (key, raw) => ipcRenderer.sendSync('store:setSync', key, raw),
  printSilent: (htmlContent) => ipcRenderer.invoke('print:silent', htmlContent),
  printSilentToPrinter: (htmlContent, printerName) => ipcRenderer.invoke('print:silentToPrinter', htmlContent, printerName),
  printSilentToPrinterDefault: (htmlContent, htmlContent2) => ipcRenderer.invoke('print:silentToPrinterDefault', htmlContent, htmlContent2),
  printWithDialog: (htmlContent) => ipcRenderer.invoke('print:withDialog', htmlContent),
  getPrinterList: () => ipcRenderer.invoke('printer:getList'),
  clearPrintQueue: (printerName) => ipcRenderer.invoke('printer:clearQueue', printerName),

  // ─── DB IPC Bridge ───
  dbIsConnected: () => ipcRenderer.invoke('db:isConnected'),

  // Users
  usersGetAll: (filters) => ipcRenderer.invoke('users:getAll', filters),
  usersGetById: (id) => ipcRenderer.invoke('users:getById', id),
  usersCreate: (data) => ipcRenderer.invoke('users:create', data),
  usersUpdate: (id, data) => ipcRenderer.invoke('users:update', { id, data }),
  usersDelete: (id) => ipcRenderer.invoke('users:delete', id),
  usersLogin: (username, password, role) => ipcRenderer.invoke('users:login', { username, password, role }),
  adminVerifyCredentials: (username, password) => ipcRenderer.invoke('admin:verifyCredentials', { username, password }),

  // Menu Items
  menuItemsGetAll: (filters) => ipcRenderer.invoke('menuItems:getAll', filters),
  menuItemsGetById: (id) => ipcRenderer.invoke('menuItems:getById', id),
  menuItemsCreate: (data) => ipcRenderer.invoke('menuItems:create', data),
  menuItemsCreateMany: (items) => ipcRenderer.invoke('menuItems:createMany', items),
  menuItemsUpdate: (id, data) => ipcRenderer.invoke('menuItems:update', { id, data }),
  menuItemsDelete: (id) => ipcRenderer.invoke('menuItems:delete', id),
  menuItemsDeleteMany: (filters) => ipcRenderer.invoke('menuItems:deleteMany', filters),

  // Orders
  ordersGetAll: (filters) => ipcRenderer.invoke('orders:getAll', filters),
  ordersGetById: (id) => ipcRenderer.invoke('orders:getById', id),
  ordersCreate: (data) => ipcRenderer.invoke('orders:create', data),
  ordersUpdate: (id, data) => ipcRenderer.invoke('orders:update', { id, data }),
  ordersDelete: (id) => ipcRenderer.invoke('orders:delete', id),
  ordersCount: (filters) => ipcRenderer.invoke('orders:count', filters),

  // Tables
  tablesGetAll: (filters) => ipcRenderer.invoke('tables:getAll', filters),
  tablesGetById: (id) => ipcRenderer.invoke('tables:getById', id),
  tablesCreate: (data) => ipcRenderer.invoke('tables:create', data),
  tablesUpdate: (id, data) => ipcRenderer.invoke('tables:update', { id, data }),
  tablesDelete: (id) => ipcRenderer.invoke('tables:delete', id),

  // Reservations
  reservationsGetAll: (filters) => ipcRenderer.invoke('reservations:getAll', filters),
  reservationsGetById: (id) => ipcRenderer.invoke('reservations:getById', id),
  reservationsCreate: (data) => ipcRenderer.invoke('reservations:create', data),
  reservationsUpdate: (id, data) => ipcRenderer.invoke('reservations:update', { id, data }),
  reservationsDelete: (id) => ipcRenderer.invoke('reservations:delete', id),

  // Inventory
  inventoryGetAll: (filters) => ipcRenderer.invoke('inventory:getAll', filters),
  inventoryGetById: (id) => ipcRenderer.invoke('inventory:getById', id),
  inventoryCreate: (data) => ipcRenderer.invoke('inventory:create', data),
  inventoryUpdate: (id, data) => ipcRenderer.invoke('inventory:update', { id, data }),
  inventoryDelete: (id) => ipcRenderer.invoke('inventory:delete', id),

  // Recipes
  recipesGetAll: (filters) => ipcRenderer.invoke('recipes:getAll', filters),
  recipesGetById: (id) => ipcRenderer.invoke('recipes:getById', id),
  recipesGetByMenuItemId: (menuItemId) => ipcRenderer.invoke('recipes:getByMenuItemId', menuItemId),
  recipesCreate: (data) => ipcRenderer.invoke('recipes:create', data),
  recipesUpdate: (id, data) => ipcRenderer.invoke('recipes:update', { id, data }),
  recipesDelete: (id) => ipcRenderer.invoke('recipes:delete', id),

  // Day Sessions
  daySessionsGetAll: (filters) => ipcRenderer.invoke('daySessions:getAll', filters),
  daySessionsGetById: (id) => ipcRenderer.invoke('daySessions:getById', id),
  daySessionsGetByDate: (businessDate) => ipcRenderer.invoke('daySessions:getByDate', businessDate),
  daySessionsCreate: (data) => ipcRenderer.invoke('daySessions:create', data),
  daySessionsUpdate: (id, data) => ipcRenderer.invoke('daySessions:update', { id, data }),
  daySessionsDelete: (id) => ipcRenderer.invoke('daySessions:delete', id),

  // Refunds
  refundsGetAll: (filters) => ipcRenderer.invoke('refunds:getAll', filters),
  refundsGetById: (id) => ipcRenderer.invoke('refunds:getById', id),
  refundsCreate: (data) => ipcRenderer.invoke('refunds:create', data),
  refundsUpdate: (id, data) => ipcRenderer.invoke('refunds:update', { id, data }),
  refundsDelete: (id) => ipcRenderer.invoke('refunds:delete', id),

  // Notifications
  notificationsGetAll: (filters) => ipcRenderer.invoke('notifications:getAll', filters),
  notificationsGetById: (id) => ipcRenderer.invoke('notifications:getById', id),
  notificationsCreate: (data) => ipcRenderer.invoke('notifications:create', data),
  notificationsUpdate: (id, data) => ipcRenderer.invoke('notifications:update', { id, data }),
  notificationsDelete: (id) => ipcRenderer.invoke('notifications:delete', id),

  // Reprint Requests
  reprintRequestsGetAll: (filters) => ipcRenderer.invoke('reprintRequests:getAll', filters),
  reprintRequestsGetById: (id) => ipcRenderer.invoke('reprintRequests:getById', id),
  reprintRequestsCreate: (data) => ipcRenderer.invoke('reprintRequests:create', data),
  reprintRequestsUpdate: (id, data) => ipcRenderer.invoke('reprintRequests:update', { id, data }),
  reprintRequestsDelete: (id) => ipcRenderer.invoke('reprintRequests:delete', id),
  reprintRequestsApprove: (id, adminName) => ipcRenderer.invoke('reprintRequests:approve', { id, adminName }),
  reprintRequestsDecline: (id, adminName) => ipcRenderer.invoke('reprintRequests:decline', { id, adminName }),

  // Settings
  settingsGetAll: (filters) => ipcRenderer.invoke('settings:getAll', filters),
  settingsGetByKey: (key) => ipcRenderer.invoke('settings:getByKey', key),
  settingsSetByKey: (key, value) => ipcRenderer.invoke('settings:setByKey', { key, value }),
  settingsSetMany: (pairs) => ipcRenderer.invoke('settings:setMany', pairs),
  settingsDeleteByKey: (key) => ipcRenderer.invoke('settings:deleteByKey', key),

  // Token Counters
  tokenCountersGetAll: (filters) => ipcRenderer.invoke('tokenCounters:getAll', filters),
  tokenCountersGetByName: (name) => ipcRenderer.invoke('tokenCounters:getByName', name),
  tokenCountersIncrement: (name, businessDate) => ipcRenderer.invoke('tokenCounters:increment', { name, businessDate }),
  tokenCountersSet: (name, value, businessDate) => ipcRenderer.invoke('tokenCounters:set', { name, value, businessDate }),
  tokenCountersReset: (name, businessDate) => ipcRenderer.invoke('tokenCounters:reset', { name, businessDate }),

  // Bulk
  dbWipeAll: () => ipcRenderer.invoke('db:wipeAll'),
  dbExportAll: () => ipcRenderer.invoke('db:exportAll'),
  dbImportAll: (data) => ipcRenderer.invoke('db:importAll', data),

  // Staff
  staffGetAll: (filters) => ipcRenderer.invoke('staff:getAll', filters),
  staffGetById: (id) => ipcRenderer.invoke('staff:getById', id),
  staffCreate: (data) => ipcRenderer.invoke('staff:create', data),
  staffUpdate: (id, data) => ipcRenderer.invoke('staff:update', { id, data }),
  staffDelete: (id) => ipcRenderer.invoke('staff:delete', id),
  staffGetStats: () => ipcRenderer.invoke('staff:getStats'),

  // Salary
  salaryGetAll: (filters) => ipcRenderer.invoke('salary:getAll', filters),
  salaryGenerate: (staffId, month, year) => ipcRenderer.invoke('salary:generate', { staffId, month, year }),
  salaryMarkPaid: (id, paymentMethod, paidBy, notes) => ipcRenderer.invoke('salary:markPaid', { id, paymentMethod, paidBy, notes }),
  salaryUpdate: (id, data) => ipcRenderer.invoke('salary:update', { id, data }),

  // Advance
  advanceGetAll: (filters) => ipcRenderer.invoke('advance:getAll', filters),
  advanceCreate: (data) => ipcRenderer.invoke('advance:create', data),
  advanceApprove: (id, approvedBy, deductMonth) => ipcRenderer.invoke('advance:approve', { id, approvedBy, deductMonth }),
  advanceDecline: (id) => ipcRenderer.invoke('advance:decline', id),

  // Attendance
  attendanceGetAll: (filters) => ipcRenderer.invoke('attendance:getAll', filters),
  attendanceMark: (data) => ipcRenderer.invoke('attendance:mark', data),
  attendanceBulkMark: (date, records) => ipcRenderer.invoke('attendance:bulkMark', { date, records }),

  // App / Upload Server
  appGetUploadPort: () => ipcRenderer.invoke('app:getUploadPort'),

  // Upload
  uploadImage: (fileData) => ipcRenderer.invoke('upload:image', fileData),
  deleteImage: (imagePath) => ipcRenderer.invoke('upload:delete', imagePath),
  getImage: (imagePath) => ipcRenderer.invoke('upload:getImage', imagePath),
})
