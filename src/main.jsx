import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles.css'
import { listUsers, addUser, ensureTokenDay, openTokens, logout, bootstrapCache } from './utils/storage.js'
import { isConnected } from './services/db.js'
import { ConfirmProvider } from './components/ConfirmProvider.jsx'

// Async initialization: bootstrap cache, seed users, ensure tokens
async function init() {
  // Load all caches from MongoDB first
  await bootstrapCache()

  // Seed default users only if DB is actually connected AND truly empty
  try {
    const connected = await isConnected()
    if (connected) {
      const users = await listUsers()
      if (Array.isArray(users) && users.length === 0) {
        await addUser({ name: 'Admin', role: 'Admin', username: 'admin', password: 'admin' })
        await addUser({ name: 'Cashier', role: 'Cashier', username: 'cashier', password: 'cashier' })
      }
      await ensureTokenDay()
      await openTokens()
    }
  } catch {}

  // Always require fresh login on app open
  try { await logout() } catch {}

  // Ensure initial route shows the login page
  try {
    const h = String(window.location.hash || '')
    if (!h || h === '#/' || h === '#') {
      window.location.hash = '#/login'
    }
  } catch {}
}

init().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </HashRouter>
    </React.StrictMode>
  )
})

