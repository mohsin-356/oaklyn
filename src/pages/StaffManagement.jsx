import { useState } from 'react'
import StaffList from './staff/StaffList.jsx'
import UsersOverview from './staff/UsersOverview.jsx'
import AttendanceTab from './staff/AttendanceTab.jsx'
import SalaryTab from './staff/SalaryTab.jsx'
import AdvancesTab from './staff/AdvancesTab.jsx'

const TABS = [
  { id: 'staff', label: 'Staff List', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )},
  { id: 'users', label: 'Users Overview', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 20V10a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v10"/>
      <path d="M12 4v4"/>
      <path d="M8 8h8"/>
    </svg>
  )},
  { id: 'attendance', label: 'Attendance', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  )},
  { id: 'salary', label: 'Salary', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )},
  { id: 'advances', label: 'Advances', icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
      <line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  )},
]

export default function StaffManagement() {
  const [activeTab, setActiveTab] = useState('staff')

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: 'calc(100vh - 140px)' }}>
      {/* Left sidebar tabs */}
      <aside style={{
        width: 200,
        minWidth: 200,
        background: '#fff',
        borderRight: '1px solid #e2e8f0',
        borderRadius: '14px 0 0 14px',
        padding: '12px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}>
        <div style={{ padding: '8px 16px 16px', fontWeight: 700, fontSize: 16, color: '#0f172a' }}>
          Staff Management
        </div>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              background: activeTab === tab.id ? 'linear-gradient(180deg, #0BAD95, #08917D)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : '#475569',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: activeTab === tab.id ? 600 : 500,
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: 18 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </aside>

      {/* Main content area */}
      <main style={{
        flex: 1,
        background: '#fff',
        borderRadius: '0 14px 14px 0',
        padding: 20,
        overflowY: 'auto',
        border: '1px solid #e2e8f0',
        borderLeft: 'none',
      }}>
        {activeTab === 'staff' && <StaffList />}
        {activeTab === 'users' && <UsersOverview />}
        {activeTab === 'attendance' && <AttendanceTab />}
        {activeTab === 'salary' && <SalaryTab />}
        {activeTab === 'advances' && <AdvancesTab />}
      </main>
    </div>
  )
}
