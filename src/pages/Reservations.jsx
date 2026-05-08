import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Reservations() {
  const nav = useNavigate()
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState(null)

  // Sample reservations data
  const [reservations, setReservations] = useState([
    { 
      id: 'R001', 
      customerName: 'Ahmed Khan', 
      phone: '+92 300 1234567',
      email: 'ahmed@email.com',
      date: '2024-01-15', 
      time: '19:00', 
      guests: 4, 
      table: 'A3',
      floor: '1st',
      status: 'confirmed',
      notes: 'Birthday celebration'
    },
    { 
      id: 'R002', 
      customerName: 'Fatima Ali', 
      phone: '+92 321 9876543',
      email: 'fatima@email.com',
      date: '2024-01-15', 
      time: '20:30', 
      guests: 6, 
      table: 'A13',
      floor: '1st',
      status: 'pending',
      notes: 'Window seat preferred'
    },
    { 
      id: 'R003', 
      customerName: 'Muhammad Raza', 
      phone: '+92 333 5557777',
      email: 'raza@email.com',
      date: '2024-01-16', 
      time: '18:00', 
      guests: 2, 
      table: 'B2',
      floor: '2nd',
      status: 'confirmed',
      notes: ''
    },
    { 
      id: 'R004', 
      customerName: 'Ayesha Siddiqui', 
      phone: '+92 312 4448888',
      email: 'ayesha@email.com',
      date: '2024-01-16', 
      time: '21:00', 
      guests: 8, 
      table: 'A7',
      floor: '1st',
      status: 'cancelled',
      notes: 'Corporate dinner'
    },
    { 
      id: 'R005', 
      customerName: 'Omar Farooq', 
      phone: '+92 345 9990000',
      email: 'omar@email.com',
      date: '2024-01-17', 
      time: '19:30', 
      guests: 4, 
      table: 'C1',
      floor: '3rd',
      status: 'confirmed',
      notes: 'Anniversary dinner'
    },
    { 
      id: 'R006', 
      customerName: 'Sanaullah Ahmed', 
      phone: '+92 322 7773333',
      email: 'sana@email.com',
      date: '2024-01-17', 
      time: '20:00', 
      guests: 5, 
      table: 'A6',
      floor: '1st',
      status: 'seated',
      notes: ''
    },
  ])

  const filteredReservations = reservations.filter(r => {
    const matchesFilter = filter === 'all' || r.status === filter
    const matchesSearch = 
      r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.table.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const getStatusBadge = (status) => {
    const styles = {
      confirmed: { bg: '#dbeafe', color: '#2563eb', text: 'Confirmed' },
      pending: { bg: '#fef3c7', color: '#d97706', text: 'Pending' },
      cancelled: { bg: '#fee2e2', color: '#dc2626', text: 'Cancelled' },
      seated: { bg: '#dcfce7', color: '#16a34a', text: 'Seated' },
      completed: { bg: '#f3f4f6', color: '#6b7280', text: 'Completed' }
    }
    const style = styles[status] || styles.pending
    return (
      <span className="reservation-status-badge" style={{ background: style.bg, color: style.color }}>
        {style.text}
      </span>
    )
  }

  const handleViewReservation = (reservation) => {
    setSelectedReservation(reservation)
    setShowModal(true)
  }

  const getTodayCount = () => reservations.filter(r => r.date === '2024-01-15' && r.status !== 'cancelled').length
  const getUpcomingCount = () => reservations.filter(r => r.status === 'confirmed').length
  const getPendingCount = () => reservations.filter(r => r.status === 'pending').length

  return (
    <div className="reservations-page">
      {/* Header */}
      <div className="reservations-header">
        <div className="reservations-title-section">
          <div className="reservations-title-with-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <div>
              <h1>Reservations</h1>
              <p>Manage table bookings and customer reservations</p>
            </div>
          </div>
        </div>
        <button className="btn-create-reservation" onClick={() => setShowModal(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Reservation
        </button>
      </div>

      {/* Stats Cards */}
      <div className="reservations-stats">
        <div className="reservation-stat-card">
          <div className="stat-icon today">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{getTodayCount()}</span>
            <span className="stat-label">Today&apos;s Bookings</span>
          </div>
        </div>
        <div className="reservation-stat-card">
          <div className="stat-icon upcoming">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{getUpcomingCount()}</span>
            <span className="stat-label">Upcoming</span>
          </div>
        </div>
        <div className="reservation-stat-card">
          <div className="stat-icon pending">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{getPendingCount()}</span>
            <span className="stat-label">Pending</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="reservations-tabs">
        {[
          { id: 'all', label: 'All Reservations', count: reservations.length },
          { id: 'confirmed', label: 'Confirmed', count: reservations.filter(r => r.status === 'confirmed').length },
          { id: 'pending', label: 'Pending', count: reservations.filter(r => r.status === 'pending').length },
          { id: 'seated', label: 'Seated', count: reservations.filter(r => r.status === 'seated').length },
          { id: 'cancelled', label: 'Cancelled', count: reservations.filter(r => r.status === 'cancelled').length },
        ].map(tab => (
          <button
            key={tab.id}
            className={`reservation-tab ${filter === tab.id ? 'active' : ''}`}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
            <span className="tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="reservations-toolbar">
        <div className="search-box">
          <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input 
            type="text" 
            placeholder="Search by name, reservation ID, or table..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Reservations Table */}
      <div className="reservations-table-container">
        <table className="reservations-table">
          <thead>
            <tr>
              <th>Reservation ID</th>
              <th>Customer</th>
              <th>Date & Time</th>
              <th>Guests</th>
              <th>Table</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReservations.map(reservation => (
              <tr key={reservation.id}>
                <td>
                  <span className="reservation-id">{reservation.id}</span>
                </td>
                <td>
                  <div className="customer-cell">
                    <div className="customer-avatar">{reservation.customerName.charAt(0)}</div>
                    <div className="customer-info">
                      <span className="customer-name">{reservation.customerName}</span>
                      <span className="customer-phone">{reservation.phone}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="datetime-cell">
                    <span className="date">{reservation.date}</span>
                    <span className="time">{reservation.time}</span>
                  </div>
                </td>
                <td>
                  <span className="guests-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    {reservation.guests} Guests
                  </span>
                </td>
                <td>
                  <span className="table-badge">{reservation.table}</span>
                  <span className="floor-badge">{reservation.floor} Floor</span>
                </td>
                <td>{getStatusBadge(reservation.status)}</td>
                <td>
                  <div className="action-buttons">
                    <button className="btn-action view" onClick={() => handleViewReservation(reservation)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                    {reservation.status === 'confirmed' && (
                      <button className="btn-action seat" title="Mark as Seated">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                      </button>
                    )}
                    <button className="btn-action cancel" title="Cancel">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredReservations.length === 0 && (
          <div className="reservations-empty">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <p>No reservations found</p>
            <span>Try adjusting your search or filter</span>
          </div>
        )}
      </div>

      {/* Reservation Detail Modal */}
      {showModal && selectedReservation && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="reservation-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reservation Details</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="reservation-detail-section">
                <div className="customer-avatar-large">{selectedReservation.customerName.charAt(0)}</div>
                <h4>{selectedReservation.customerName}</h4>
                <p>{selectedReservation.email}</p>
                <p>{selectedReservation.phone}</p>
              </div>
              <div className="reservation-info-grid">
                <div className="info-item">
                  <label>Reservation ID</label>
                  <span>{selectedReservation.id}</span>
                </div>
                <div className="info-item">
                  <label>Date</label>
                  <span>{selectedReservation.date}</span>
                </div>
                <div className="info-item">
                  <label>Time</label>
                  <span>{selectedReservation.time}</span>
                </div>
                <div className="info-item">
                  <label>Guests</label>
                  <span>{selectedReservation.guests} people</span>
                </div>
                <div className="info-item">
                  <label>Table</label>
                  <span>{selectedReservation.table} ({selectedReservation.floor} Floor)</span>
                </div>
                <div className="info-item">
                  <label>Status</label>
                  {getStatusBadge(selectedReservation.status)}
                </div>
              </div>
              {selectedReservation.notes && (
                <div className="reservation-notes">
                  <label>Special Notes</label>
                  <p>{selectedReservation.notes}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Close</button>
              {selectedReservation.status === 'confirmed' && (
                <button className="btn-primary">Mark as Seated</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
