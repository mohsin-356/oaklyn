import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listTables, addTable, updateTable, deleteTable, updateTableStatus, getCurrentUser } from '../utils/storage.js'

export default function TableManagement() {
  const toId = (raw) => {
    if (raw == null) return ''
    if (typeof raw === 'string' || typeof raw === 'number') return String(raw)
    if (typeof raw === 'object') {
      if (raw.$oid) return String(raw.$oid)
      if (raw.oid) return String(raw.oid)
      if (raw._id != null) return toId(raw._id)
      if (raw.id != null) return toId(raw.id)
      if (typeof raw.toString === 'function' && raw.toString !== Object.prototype.toString) {
        const s = String(raw.toString())
        return s === '[object Object]' ? '' : s
      }
      return ''
    }
    return String(raw)
  }

  const normalizeFloor = (value) => String(value || '').trim().toLowerCase()

  const floorMatches = (tableFloor, floor) => {
    const tf = normalizeFloor(tableFloor)
    const floorId = String(floor?.id || '')
    const floorName = normalizeFloor(floor?.name)
    if (!tf) return false
    if (tf === normalizeFloor(floorId) || tf === floorName) return true

    const aliases = {
      '1': ['ground floor', 'groundfloor', 'gf'],
      '2': ['1st floor', 'first floor', '1 floor'],
      '3': ['2nd floor', 'second floor', '2 floor'],
    }
    return (aliases[floorId] || []).includes(tf)
  }

  const nav = useNavigate()
  const user = getCurrentUser()
  const isAdmin = user && String(user.role||'').toLowerCase() === 'admin'
  
  const [selectedFloor, setSelectedFloor] = useState('1')
  const [tables, setTables] = useState([])
  const [floors, setFloors] = useState([{ id: '1', name: 'Ground Floor' }, { id: '2', name: '1st Floor' }, { id: '3', name: '2nd Floor' }])
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddFloorModal, setShowAddFloorModal] = useState(false)
  const [showFloorSettingsModal, setShowFloorSettingsModal] = useState(false)
  const [editTable, setEditTable] = useState(null)
  const [newTable, setNewTable] = useState({ number: '', floor: '', capacity: 4, shape: 'square' })
  const [newFloorName, setNewFloorName] = useState('')
  const [editingFloorId, setEditingFloorId] = useState(null)
  const [editingFloorName, setEditingFloorName] = useState('')
  
  // Time tracking for occupied tables
  const [currentTime, setCurrentTime] = useState(Date.now())
  
  // Update time every minute for elapsed time display
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])
  
  // Load tables from storage on mount
  useEffect(() => {
    const load = async () => {
      const loadedTables = await listTables()
      const safeTables = Array.isArray(loadedTables) ? loadedTables : []
      if (safeTables.length === 0) {
        // Seed defaults only once — check flag to avoid duplicates on remount
        const seeded = localStorage.getItem('tables_seeded')
        if (!seeded) {
          const defaultTables = [
            { number: 'A1', floor: '1', status: 'available', capacity: 4 },
            { number: 'A2', floor: '1', status: 'available', capacity: 4 },
            { number: 'A3', floor: '1', status: 'available', capacity: 6 },
            { number: 'A4', floor: '1', status: 'available', capacity: 4 },
            { number: 'A5', floor: '1', status: 'available', capacity: 4 },
            { number: 'B1', floor: '2', status: 'available', capacity: 4 },
            { number: 'B2', floor: '2', status: 'available', capacity: 4 },
            { number: 'B3', floor: '2', status: 'available', capacity: 6 },
            { number: 'C1', floor: '3', status: 'available', capacity: 4 },
          ]
          for (const t of defaultTables) await addTable(t)
          localStorage.setItem('tables_seeded', '1')
          setTables(await listTables())
        } else {
          setTables(safeTables)
        }
      } else {
        setTables(safeTables)
      }
    }
    load()
    
    const handleChange = () => { listTables().then(r => setTables(Array.isArray(r) ? r : [])).catch(()=>{}) }
    window.addEventListener('tables:changed', handleChange)
    window.addEventListener('storage', handleChange)
    return () => {
      window.removeEventListener('tables:changed', handleChange)
      window.removeEventListener('storage', handleChange)
    }
  }, [])

  const selectedFloorObj = floors.find(f => String(f.id || f._id || '') === String(selectedFloor || ''))
  const filteredTables = tables.filter(t => floorMatches(t.floor, selectedFloorObj))

  const getTableName = (table) => table?.name || table?.number || ''
  const getTableSeats = (table) => Number(table?.seats ?? table?.capacity ?? 0)

  // Format elapsed time (e.g., "1h 23m")
  const getElapsedTime = (occupiedAt) => {
    if (!occupiedAt) return ''
    const elapsed = currentTime - occupiedAt
    const hours = Math.floor(elapsed / 3600000)
    const minutes = Math.floor((elapsed % 3600000) / 60000)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  // Format currency
  const formatMoney = (n) => {
    const v = isNaN(n) ? 0 : n
    return `Rs.${v.toLocaleString()}`
  }

  // Get status badge color
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'available': return 'status-available'
      case 'occupied': return 'status-occupied'
      case 'reserved': return 'status-reserved'
      default: return 'status-available'
    }
  }

  // Get status label
  const getStatusLabel = (status) => {
    switch (status) {
      case 'available': return 'Available'
      case 'occupied': return 'Occupied'
      case 'reserved': return 'Reserved'
      default: return 'Available'
    }
  }

  // Handle table click - open order directly
  const handleTableClick = (table) => {
    nav('/pos', { state: { tableId: String(table.id || table._id || ''), tableName: table.name || table.number || '' } })
  }

  // Handle create new order without table
  const handleCreateOrder = () => {
    nav('/pos')
  }

  // Admin: Edit table handlers
  const handleEditTable = (table, e) => {
    e.stopPropagation()
    setEditTable({ ...table })
    setShowEditModal(true)
  }

  const handleSaveEditTable = async () => {
    if (editTable) {
      const result = await updateTable({
        id: toId(editTable.id || editTable._id),
        number: editTable.number || editTable.tableNumber || editTable.name,
        floor: editTable.floor,
        capacity: Number(editTable.capacity || editTable.seats || 4),
        status: String(editTable.status || 'available').toLowerCase(),
        shape: editTable.shape || 'square'
      })
      if (result && result.error) { alert('Failed to update table: ' + result.error); return }
      setTables(await listTables())
      setShowEditModal(false)
      setEditTable(null)
    }
  }

  const handleDeleteTable = async (tableId, e) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this table?')) {
      const result = await deleteTable(toId(tableId))
      if (result && result.error) { alert('Failed to delete table: ' + result.error); return }
      setTables(await listTables())
    }
  }

  const handleAddTable = async () => {
    if (newTable.number.trim()) {
      const selected = floors.find(f => String(f.id || f._id || '') === String(newTable.floor || selectedFloor || ''))
      const result = await addTable({
        number: newTable.number,
        floor: selected?.name || 'Ground Floor',
        capacity: Number(newTable.capacity),
        status: 'available',
        shape: newTable.shape || 'square'
      })
      if (result && result.error) { alert('Failed to add table: ' + result.error); return }
      setTables(await listTables())
      setShowAddModal(false)
      setNewTable({ number: '', floor: '1', capacity: 4, shape: 'square' })
    }
  }

  // Admin: Floor management
  const handleAddFloor = () => {
    if (newFloorName.trim()) {
      const newId = String(Date.now())
      const updatedFloors = [...floors, { id: newId, name: newFloorName.trim() }]
      setFloors(updatedFloors)
      localStorage.setItem('floors', JSON.stringify(updatedFloors))
      setNewFloorName('')
      setShowAddFloorModal(false)
    }
  }

  // Inline floor edit handlers
  const startEditingFloor = (floor) => {
    setEditingFloorId(floor.id)
    setEditingFloorName(floor.name)
  }

  const saveFloorEdit = () => {
    if (editingFloorName.trim()) {
      const updatedFloors = floors.map(f => f.id === editingFloorId ? { ...f, name: editingFloorName.trim() } : f)
      setFloors(updatedFloors)
      localStorage.setItem('floors', JSON.stringify(updatedFloors))
    }
    setEditingFloorId(null)
    setEditingFloorName('')
  }

  const cancelFloorEdit = () => {
    setEditingFloorId(null)
    setEditingFloorName('')
  }

  const handleDeleteFloor = (floorId) => {
    const floorObj = floors.find(f => String(f.id || f._id || '') === String(floorId || ''))
    const tablesOnFloor = tables.filter(t => floorMatches(t.floor, floorObj))
    if (tablesOnFloor.length > 0) {
      alert(`Cannot delete floor with ${tablesOnFloor.length} tables. Move or delete tables first.`)
      return
    }
    if (confirm('Are you sure you want to delete this floor?')) {
      const updatedFloors = floors.filter(f => f.id !== floorId)
      setFloors(updatedFloors)
      localStorage.setItem('floors', JSON.stringify(updatedFloors))
      if (selectedFloor === floorId && updatedFloors.length > 0) {
        setSelectedFloor(updatedFloors[0].id)
      }
    }
  }

  // Load floors from storage on mount
  useEffect(() => {
    const savedFloors = localStorage.getItem('floors')
    if (savedFloors) {
      setFloors(JSON.parse(savedFloors))
    }
  }, [])

  const getStatusCounts = () => {
    return {
      available: tables.filter(t => t.status === 'available').length,
      occupied: tables.filter(t => t.status === 'occupied').length,
      reserved: tables.filter(t => t.status === 'reserved').length
    }
  }

  const counts = getStatusCounts()

  return (
    <div className="table-management-page">
      {/* Header */}
      <div className="table-header">
        <h1 className="table-page-title">Table</h1>
        <div className="table-header-actions">
          {isAdmin && (
            <>
              <button className="btn-floor-settings" onClick={() => setShowFloorSettingsModal(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.17 15a1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.17a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.6 9a1.65 1.65 0 0 0 1.51 1H22a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Floor Settings
              </button>
              <button className="btn-add-table" onClick={() => setShowAddModal(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"/>
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Table
              </button>
            </>
          )}
          <button className="btn-create-order" onClick={handleCreateOrder}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Order
          </button>
        </div>
      </div>

      {/* Status Summary Pills */}
      <div className="status-summary">
        <div className="status-pill available">
          <span className="status-dot"></span>
          <span className="status-count">{counts.available}</span>
          <span className="status-label">Available</span>
        </div>
        <div className="status-pill occupied">
          <span className="status-dot"></span>
          <span className="status-count">{counts.occupied}</span>
          <span className="status-label">Occupied</span>
        </div>
        <div className="status-pill reserved">
          <span className="status-dot"></span>
          <span className="status-count">{counts.reserved}</span>
          <span className="status-label">Reserved</span>
        </div>
      </div>

      {/* Floor Tabs */}
      <div className="floor-tabs">
        {floors.map(floor => (
          <div key={String(floor.id || floor._id || floor.name)} className="floor-tab-wrapper">
            {String(editingFloorId || '') === String(floor.id || floor._id || '') ? (
              <div className="floor-tab-edit">
                <input
                  type="text"
                  value={editingFloorName}
                  onChange={(e) => setEditingFloorName(e.target.value)}
                  onBlur={saveFloorEdit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveFloorEdit()
                    if (e.key === 'Escape') cancelFloorEdit()
                  }}
                  autoFocus
                  className="floor-edit-input"
                />
              </div>
            ) : (
              <button
                className={`floor-tab ${String(selectedFloor || '') === String(floor.id || floor._id || '') ? 'active' : ''}`}
                onClick={() => setSelectedFloor(String(floor.id || floor._id || ''))}
              >
                {floor.name}
              </button>
            )}
            {isAdmin && String(editingFloorId || '') !== String(floor.id || floor._id || '') && (
              <button
                className="floor-edit-btn"
                onClick={(e) => { e.stopPropagation(); startEditingFloor(floor); }}
                title="Rename Floor"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            )}
          </div>
        ))}
        {isAdmin && (
          <button className="floor-tab add-floor" onClick={() => setShowAddFloorModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Floor
          </button>
        )}
      </div>

      {/* Tables Grid */}
      <div className="tables-layout">
        {filteredTables.map(table => (
          <div
            key={toId(table.id || table._id) || String(table.number || table.tableNumber || table.name)}
            className={`table-card ${table.status}`}
            onClick={() => handleTableClick(table)}
          >
            {/* Admin Actions */}
            {isAdmin && (
              <div className="table-admin-actions">
                <button 
                  className="table-action-btn edit" 
                  onClick={(e) => handleEditTable(table, e)}
                  title="Edit Table"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button
                  className="table-action-btn delete"
                  onClick={(e) => handleDeleteTable(table.id || table._id, e)}
                  title="Delete Table"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            )}
            
            {/* Table Number & Seat Count Header */}
            <div className="table-card-header">
              <span className="table-number">{getTableName(table)}</span>
              <span className="table-seats">{getTableSeats(table)} Seats</span>
            </div>
            
            {/* Status Badge */}
            <div className={`table-status-badge ${getStatusBadgeClass(table.status)}`}>
              {getStatusLabel(table.status)}
            </div>
            
            {/* Occupied Table Info */}
            {table.status === 'occupied' && (
              <div className="table-info occupied-info">
                <div className="info-row">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>{getElapsedTime(table.occupiedAt)}</span>
                </div>
                <div className="info-row total">
                  <span>{formatMoney(table.orderTotal || 0)}</span>
                </div>
                {table.waiter && (
                  <div className="info-row waiter">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>{table.waiter}</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Reserved Table Info */}
            {table.status === 'reserved' && (
              <div className="table-info reserved-info">
                <div className="info-row">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span>{table.reservationTime || '18:00'}</span>
                </div>
                {table.guestName && (
                  <div className="info-row guest">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                    <span>{table.guestName}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>


      {/* Add Table Modal - Admin Only */}
      {showAddModal && isAdmin && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="table-modal edit-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Table</h3>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <div className="modal-form">
              <div className="form-row">
                <label>Table Number/Name</label>
                <input 
                  type="text" 
                  value={newTable.number}
                  onChange={(e) => setNewTable({...newTable, number: e.target.value})}
                  placeholder="e.g., A15"
                />
              </div>
              <div className="form-row">
                <label>Floor</label>
                <select 
                  value={newTable.floor}
                  onChange={(e) => setNewTable({...newTable, floor: e.target.value})}
                >
                  <option value="">Select Floor</option>
                  {floors.map(floor => {
                    const floorKey = String(floor.id || floor._id || floor.name)
                    return <option key={floorKey} value={String(floor.id || floor._id || '')}>{floor.name}</option>
                  })}
                </select>
              </div>
              <div className="form-row">
                <label>Capacity (Seats)</label>
                <input 
                  type="number" 
                  value={newTable.capacity}
                  onChange={(e) => setNewTable({...newTable, capacity: parseInt(e.target.value) || 4})}
                  min="1"
                  max="20"
                />
              </div>
              <div className="form-row">
                <label>Table Shape</label>
                <select 
                  value={newTable.shape}
                  onChange={(e) => setNewTable({...newTable, shape: e.target.value})}
                >
                  <option value="square">Square</option>
                  <option value="round">Round</option>
                  <option value="rectangle">Rectangle</option>
                </select>
              </div>
              <div className="form-actions">
                <button className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleAddTable}>Add Table</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Table Modal - Admin Only */}
      {showEditModal && editTable && isAdmin && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="table-modal edit-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Table</h3>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-form">
              <div className="form-row">
                <label>Table Number/Name</label>
                <input 
                  type="text" 
                  value={editTable.number || editTable.name || ''}
                  onChange={(e) => setEditTable({...editTable, number: e.target.value})}
                />
              </div>
              <div className="form-row">
                <label>Floor</label>
                <select 
                  value={editTable.floor}
                  onChange={(e) => setEditTable({...editTable, floor: e.target.value})}
                >
                  {floors.map(floor => {
                    const floorKey = String(floor.id || floor._id || floor.name)
                    return <option key={floorKey} value={String(floor.id || floor._id || '')}>{floor.name}</option>
                  })}
                </select>
              </div>
              <div className="form-row">
                <label>Capacity (Seats)</label>
                <input 
                  type="number" 
                  value={editTable.capacity || editTable.seats || 4}
                  onChange={(e) => setEditTable({...editTable, capacity: parseInt(e.target.value) || 4})}
                  min="1"
                  max="20"
                />
              </div>
              <div className="form-row">
                <label>Status</label>
                <select 
                  value={editTable.status}
                  onChange={(e) => setEditTable({...editTable, status: e.target.value})}
                >
                  <option value="available">Available</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                  <option value="in-progress">In Progress</option>
                </select>
              </div>
              <div className="form-row">
                <label>Table Shape</label>
                <select 
                  value={editTable.shape || 'square'}
                  onChange={(e) => setEditTable({...editTable, shape: e.target.value})}
                >
                  <option value="square">Square</option>
                  <option value="round">Round</option>
                  <option value="rectangle">Rectangle</option>
                </select>
              </div>
              <div className="form-actions">
                <button className="btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleSaveEditTable}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Floor Modal */}
      {showAddFloorModal && isAdmin && (
        <div className="modal-overlay" onClick={() => setShowAddFloorModal(false)}>
          <div className="table-modal edit-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Floor</h3>
              <button className="close-btn" onClick={() => setShowAddFloorModal(false)}>×</button>
            </div>
            <div className="modal-form">
              <div className="form-row">
                <label>Floor Name</label>
                <input 
                  type="text" 
                  value={newFloorName}
                  onChange={(e) => setNewFloorName(e.target.value)}
                  placeholder="e.g., Rooftop Terrace"
                />
              </div>
              <div className="form-actions">
                <button className="btn-secondary" onClick={() => setShowAddFloorModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleAddFloor}>Add Floor</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floor Settings Modal - For managing floors including delete */}
      {showFloorSettingsModal && isAdmin && (
        <div className="modal-overlay" onClick={() => setShowFloorSettingsModal(false)}>
          <div className="table-modal edit-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Floor Settings</h3>
              <button className="close-btn" onClick={() => setShowFloorSettingsModal(false)}>×</button>
            </div>
            <div className="modal-form">
              <div className="floor-list">
                {floors.map(floor => (
                  <div key={String(floor.id || floor._id || floor.name)} className="floor-list-item">
                    <span>{floor.name}</span>
                    <button 
                      className="btn-delete-floor"
                      onClick={() => handleDeleteFloor(String(floor.id || floor._id || ''))}
                      disabled={tables.some(t => floorMatches(t.floor, floor))}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <div className="form-actions">
                <button className="btn-secondary" onClick={() => setShowFloorSettingsModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
