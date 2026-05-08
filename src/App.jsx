import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { getCurrentUser } from './utils/storage.js'
import { 
  isSuperAdminAuthenticated, 
  getValidSession, 
  isSessionExpired,
  isCompanyLoggedIn 
} from './utils/jwtAuth.js'
import Navbar from './components/Navbar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import UnifiedPos from './pages/UnifiedPos.jsx'
import Recipes from './pages/Recipes.jsx'
import SaleHistory from './pages/SaleHistory.jsx'
import ReturnOrder from './pages/ReturnOrder.jsx'
import ReturnHistory from './pages/ReturnHistory.jsx'
import AddItems from './pages/AddItemsSimple.jsx'
import UserManagement from './pages/UserManagement.jsx'
import Login from './pages/Login.jsx'
import Logout from './pages/Logout.jsx'
import SuperAdminLogin from './pages/SuperAdminLogin.jsx'
import SessionSelector from './pages/SessionSelector.jsx'
import Consumption from './pages/Consumption.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'
import DayClose from './pages/DayClose.jsx'
import DayOpen from './pages/DayOpen.jsx'
import BusinessDateBadge from './components/BusinessDateBadge.jsx'
import RecentSales from './pages/RecentSales.jsx'
import Orders from './pages/Orders.jsx'
import TableManagement from './pages/TableManagement.jsx'
import Reservations from './pages/Reservations.jsx'
import Inventory from './pages/Inventory.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import StaffManagement from './pages/StaffManagement.jsx'

export default function App() {
  const location = useLocation()
  
  // Session expiry check
  useEffect(() => {
    const checkSession = () => {
      // If not on auth pages and session is expired, redirect to super admin
      const authPages = ['/super-admin', '/select-session', '/login', '/logout']
      if (!authPages.includes(location.pathname)) {
        if (isSessionExpired()) {
          // Session expired - force redirect to super admin login
          window.location.href = '/super-admin'
        }
      }
    }
    
    checkSession()
    const interval = setInterval(checkSession, 5000) // Check every 5 seconds
    return () => clearInterval(interval)
  }, [location.pathname])

  // Auth guard: Check super admin auth
  const RequireSuperAdmin = ({ children }) => {
    if (!isSuperAdminAuthenticated()) {
      return <Navigate to="/super-admin" replace />
    }
    return children
  }

  // Auth guard: Check valid session
  const RequireSession = ({ children }) => {
    const session = getValidSession()
    if (!session) {
      // Session expired or not set - always redirect to super admin for new session
      return <Navigate to="/super-admin" replace />
    }
    return children
  }

  // Auth guard: Check company user login
  const RequireAuth = ({ children }) => {
    // First check if session is valid
    const session = getValidSession()
    if (!session) {
      // Session expired - redirect to super admin login
      return <Navigate to="/super-admin" replace />
    }
    
    // Then check if company user is logged in
    const user = getCurrentUser()
    if (!user) return <Navigate to="/login" replace />
    return children
  }
  
  const RequireNotCashier = ({ children }) => {
    const user = getCurrentUser()
    if (user && String(user.role||'').toLowerCase() === 'cashier') {
      return <Navigate to="/pos" replace />
    }
    return children
  }
  
  const CashierDashboard = () => {
    const user = getCurrentUser()
    if (user && String(user.role||'').toLowerCase() === 'cashier') {
      return <Navigate to="/pos" replace />
    }
    return <Dashboard />
  }

  const showHeader = location.pathname !== '/login' && location.pathname !== '/super-admin' && location.pathname !== '/select-session'
  // Pages that should use full-width layout
  return (
    <div className="app">
      {showHeader && <Navbar />}
      <main className="container full">
        {showHeader && (
          <div style={{display:'flex', justifyContent:'flex-end', marginBottom:8}}>
            <BusinessDateBadge />
          </div>
        )}
        <Routes>
          {/* JWT Auth Flow Routes */}
          <Route path="/super-admin" element={<SuperAdminLogin />} />
          <Route path="/select-session" element={<RequireSuperAdmin><SessionSelector /></RequireSuperAdmin>} />
          
          {/* Main App Routes */}
          <Route path="/" element={<RequireAuth><CashierDashboard /></RequireAuth>} />
          <Route path="/add-items" element={<RequireAuth><RequireNotCashier><ErrorBoundary><AddItems /></ErrorBoundary></RequireNotCashier></RequireAuth>} />
          <Route path="/pos" element={<RequireAuth><UnifiedPos /></RequireAuth>} />
          <Route path="/recipes" element={<RequireAuth><RequireNotCashier><Recipes /></RequireNotCashier></RequireAuth>} />
          <Route path="/login" element={<RequireSession><Login /></RequireSession>} />
          <Route path="/logout" element={<Logout />} />
          <Route path="/users" element={<RequireAuth><RequireNotCashier><UserManagement /></RequireNotCashier></RequireAuth>} />
          <Route path="/staff" element={<RequireAuth><RequireNotCashier><ErrorBoundary><StaffManagement /></ErrorBoundary></RequireNotCashier></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><RequireNotCashier><ErrorBoundary><Settings /></ErrorBoundary></RequireNotCashier></RequireAuth>} />
          <Route path="/day-open" element={<RequireAuth><RequireNotCashier><DayOpen /></RequireNotCashier></RequireAuth>} />
          <Route path="/day-close" element={<RequireAuth><RequireNotCashier><DayClose /></RequireNotCashier></RequireAuth>} />
          <Route path="/consumption" element={<RequireAuth><RequireNotCashier><Consumption /></RequireNotCashier></RequireAuth>} />
          <Route path="/reports" element={<RequireAuth><RequireNotCashier><Reports /></RequireNotCashier></RequireAuth>} />
          <Route path="/sales" element={<RequireAuth><RequireNotCashier><SaleHistory /></RequireNotCashier></RequireAuth>} />
          <Route path="/returns" element={<RequireAuth><RequireNotCashier><ReturnOrder /></RequireNotCashier></RequireAuth>} />
          <Route path="/return-history" element={<RequireAuth><RequireNotCashier><ReturnHistory /></RequireNotCashier></RequireAuth>} />
          <Route path="/recent-sales" element={<RequireAuth><RecentSales /></RequireAuth>} />
          <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
          <Route path="/tables" element={<RequireAuth><TableManagement /></RequireAuth>} />
          <Route path="/reservation" element={<RequireAuth><Reservations /></RequireAuth>} />
          <Route path="/inventory" element={<RequireAuth><Inventory /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/super-admin" />} />
        </Routes>
      </main>
    </div>
  )
}

