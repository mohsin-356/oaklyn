import { useState, useEffect } from 'react'
import { listInventory, addInventoryItem, updateInventoryItem, deleteInventoryItem, updateInventoryStock } from '../utils/storage.js'

export default function Inventory() {
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [lowStockFilter, setLowStockFilter] = useState(false)
  const [inventory, setInventory] = useState([])

  // Load inventory from storage on mount
  useEffect(() => {
    const load = async () => {
      const loadedInventory = await listInventory()
      const safeInventory = Array.isArray(loadedInventory) ? loadedInventory : []
      // If no inventory exists, create default sample items
      if (safeInventory.length === 0) {
        const defaultItems = [
          // Raw Materials
          { name: 'Beef Patties', category: 'raw', unit: 'kg', quantity: 45, minStock: 20, costPrice: 850, supplier: 'Local Meat Co.' },
          { name: 'Chicken Breast', category: 'raw', unit: 'kg', quantity: 32, minStock: 15, costPrice: 620, supplier: 'Poultry Farm' },
          { name: 'Burger Buns', category: 'raw', unit: 'pcs', quantity: 120, minStock: 50, costPrice: 25, supplier: 'Bakery House' },
          { name: 'Lettuce', category: 'raw', unit: 'kg', quantity: 8, minStock: 10, costPrice: 120, supplier: 'Fresh Veggies' },
          { name: 'Tomatoes', category: 'raw', unit: 'kg', quantity: 15, minStock: 8, costPrice: 80, supplier: 'Fresh Veggies' },
          { name: 'Cheese Slices', category: 'raw', unit: 'pcs', quantity: 200, minStock: 100, costPrice: 15, supplier: 'Dairy Best' },
          { name: 'Pickles', category: 'raw', unit: 'jar', quantity: 12, minStock: 5, costPrice: 180, supplier: 'Preserved Foods' },
          { name: 'Onions', category: 'raw', unit: 'kg', quantity: 25, minStock: 10, costPrice: 60, supplier: 'Fresh Veggies' },
          // Beverages
          { name: 'Coca Cola 500ml', category: 'beverage', unit: 'bottle', quantity: 150, minStock: 50, costPrice: 80, supplier: 'Coca Cola Pak' },
          { name: 'Sprite 500ml', category: 'beverage', unit: 'bottle', quantity: 120, minStock: 50, costPrice: 80, supplier: 'Coca Cola Pak' },
          { name: 'Fanta 500ml', category: 'beverage', unit: 'bottle', quantity: 80, minStock: 40, costPrice: 80, supplier: 'Coca Cola Pak' },
          { name: 'Water 500ml', category: 'beverage', unit: 'bottle', quantity: 200, minStock: 100, costPrice: 40, supplier: 'Aqua Pure' },
          { name: 'Milkshake Mix', category: 'beverage', unit: 'kg', quantity: 15, minStock: 5, costPrice: 450, supplier: 'Dairy Best' },
        ]
        for (const item of defaultItems) await addInventoryItem(item)
        setInventory(await listInventory())
      } else {
        setInventory(safeInventory)
      }
    }
    load()
    
    // Listen for storage changes
    const handleChange = () => { listInventory().then(r => setInventory(Array.isArray(r) ? r : [])).catch(()=>{}) }
    window.addEventListener('inventory:changed', handleChange)
    window.addEventListener('storage', handleChange)
    return () => {
      window.removeEventListener('inventory:changed', handleChange)
      window.removeEventListener('storage', handleChange)
    }
  }, [])

  const categories = [
    { id: 'all', label: 'All Items', icon: 'box' },
    { id: 'raw', label: 'Raw Materials', icon: 'utensils' },
    { id: 'beverage', label: 'Beverages', icon: 'coffee' },
    { id: 'packaging', label: 'Packaging', icon: 'package' },
    { id: 'cleaning', label: 'Cleaning', icon: 'sparkles' },
  ]

  const filteredInventory = inventory.filter(item => {
    const matchesTab = activeTab === 'all' || item.category === activeTab
    const matchesSearch = 
      (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(item.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.supplier || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLowStock = !lowStockFilter || (item.stock || 0) <= (item.minStock || 0)
    return matchesTab && matchesSearch && matchesLowStock
  })

  const getStockStatus = (item) => {
    const ratio = item.stock / item.minStock
    if (item.stock === 0) return { label: 'Out of Stock', color: '#dc2626', bg: '#fee2e2' }
    if (ratio <= 1) return { label: 'Low Stock', color: '#d97706', bg: '#fef3c7' }
    if (ratio <= 1.5) return { label: 'Moderate', color: '#2563eb', bg: '#dbeafe' }
    return { label: 'In Stock', color: '#16a34a', bg: '#dcfce7' }
  }

  const getStockPercentage = (item) => {
    const maxStock = item.minStock * 3
    return Math.min(100, (item.stock / maxStock) * 100)
  }

  const handleEditItem = (item) => {
    setSelectedItem(item)
    setFormData({
      name: item.name || '',
      category: item.category || 'raw',
      unit: item.unit || '',
      stock: item.stock || item.quantity || 0,
      minStock: item.minStock || 0,
      price: item.price || item.costPrice || 0,
      supplier: item.supplier || ''
    })
    setShowModal(true)
  }

  const handleAddItem = () => {
    setSelectedItem(null)
    setFormData({
      name: '',
      category: 'raw',
      unit: '',
      stock: 0,
      minStock: 10,
      price: 0,
      supplier: ''
    })
    setShowModal(true)
  }

  const [formData, setFormData] = useState({
    name: '',
    category: 'raw',
    unit: '',
    stock: 0,
    minStock: 10,
    price: 0,
    supplier: ''
  })

  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSaveItem = async () => {
    if (!formData.name.trim()) {
      alert('Please enter item name')
      return
    }

    const itemData = {
      name: formData.name,
      category: formData.category,
      unit: formData.unit,
      quantity: parseInt(formData.stock) || 0,
      minStock: parseInt(formData.minStock) || 0,
      costPrice: parseFloat(formData.price) || 0,
      supplier: formData.supplier
    }

    if (selectedItem) {
      // Update existing item
      const result = await updateInventoryItem({ ...selectedItem, ...itemData })
      if (result && result.error) { alert('Failed to update: ' + result.error); return }
    } else {
      // Add new item
      const result = await addInventoryItem(itemData)
      if (result && result.error) { alert('Failed to add: ' + result.error); return }
    }
    
    setShowModal(false)
    setSelectedItem(null)
    // Refresh inventory list
    setInventory(await listInventory())
  }

  const handleDeleteItem = async (id) => {
    if (confirm('Are you sure you want to delete this item?')) {
      const result = await deleteInventoryItem(String(id))
      if (result && result.error) { alert('Failed to delete: ' + result.error); return }
      setInventory(await listInventory())
    }
  }

  const getTotalItems = () => inventory.length
  const getLowStockCount = () => inventory.filter(i => i.stock <= i.minStock).length
  const getOutOfStockCount = () => inventory.filter(i => i.stock === 0).length
  const getInventoryValue = () => inventory.reduce((sum, i) => sum + (i.stock * i.price), 0)

  return (
    <div className="inventory-page">
      {/* Header */}
      <div className="inventory-header">
        <div className="inventory-title-section">
          <div className="inventory-title-with-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <div>
              <h1>Inventory</h1>
              <p>Manage stock levels and supplies</p>
            </div>
          </div>
        </div>
        <div className="inventory-actions">
          <button className="btn-filter" onClick={() => setLowStockFilter(!lowStockFilter)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            {lowStockFilter ? 'Show All' : 'Low Stock Only'}
          </button>
          <button className="btn-create-item" onClick={handleAddItem}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Item
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="inventory-stats">
        <div className="inventory-stat-card">
          <div className="stat-icon items">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{getTotalItems()}</span>
            <span className="stat-label">Total Items</span>
          </div>
        </div>
        <div className="inventory-stat-card">
          <div className="stat-icon warning">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{getLowStockCount()}</span>
            <span className="stat-label">Low Stock</span>
          </div>
        </div>
        <div className="inventory-stat-card">
          <div className="stat-icon danger">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">{getOutOfStockCount()}</span>
            <span className="stat-label">Out of Stock</span>
          </div>
        </div>
        <div className="inventory-stat-card">
          <div className="stat-icon value">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <div className="stat-info">
            <span className="stat-value">Rs.{getInventoryValue().toLocaleString()}</span>
            <span className="stat-label">Inventory Value</span>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="inventory-tabs">
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`inventory-tab ${activeTab === cat.id ? 'active' : ''}`}
            onClick={() => setActiveTab(cat.id)}
          >
            {cat.label}
            <span className="tab-count">
              {cat.id === 'all' ? inventory.length : inventory.filter(i => i.category === cat.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="inventory-toolbar">
        <div className="search-box">
          <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input 
            type="text" 
            placeholder="Search items by name, ID, or supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Inventory Grid */}
      <div className="inventory-grid">
        {filteredInventory.map(item => {
          const status = getStockStatus(item)
          const percentage = getStockPercentage(item)
          return (
            <div key={String(item.id || item._id || Math.random())} className="inventory-card">
              <div className="inventory-card-header">
                <div className="inventory-icon">
                  {item.category === 'raw' && (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
                      <path d="M7 2v20"/>
                      <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
                    </svg>
                  )}
                  {item.category === 'beverage' && (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
                      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
                      <line x1="6" y1="2" x2="6" y2="4"/>
                      <line x1="10" y1="2" x2="10" y2="4"/>
                      <line x1="14" y1="2" x2="14" y2="4"/>
                    </svg>
                  )}
                  {item.category === 'packaging' && (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    </svg>
                  )}
                  {item.category === 'cleaning' && (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18"/>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  )}
                </div>
                <div className="inventory-status-badge" style={{ background: status.bg, color: status.color }}>
                  {status.label}
                </div>
              </div>
              
              <div className="inventory-info">
                <span className="inventory-id">{String(item.id || '').slice(-6)}</span>
                <h4 className="inventory-name">{item.name}</h4>
                <p className="inventory-supplier">{item.supplier}</p>
              </div>

              <div className="inventory-stock-section">
                <div className="stock-header">
                  <span className="stock-current">{item.stock} <small>{item.unit}</small></span>
                  <span className="stock-min">Min: {item.minStock}</span>
                </div>
                <div className="stock-bar">
                  <div 
                    className="stock-progress" 
                    style={{ 
                      width: `${percentage}%`,
                      background: status.color
                    }}
                  ></div>
                </div>
              </div>

              <div className="inventory-footer">
                <span className="inventory-price">Rs.{item.price || item.costPrice}/{item.unit}</span>
                <div style={{display: 'flex', gap: '8px'}}>
                  <button className="btn-edit-item" onClick={() => handleEditItem(item)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit
                  </button>
                  <button className="btn-edit-item" onClick={() => handleDeleteItem(String(item.id || item._id))} style={{color: '#dc2626'}}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filteredInventory.length === 0 && (
        <div className="inventory-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
          <p>No items found</p>
          <span>Try adjusting your search or filters</span>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="inventory-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedItem ? 'Edit Item' : 'Add New Item'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Item Name</label>
                <input type="text" value={formData.name} onChange={(e) => handleFormChange('name', e.target.value)} placeholder="Enter item name" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select value={formData.category} onChange={(e) => handleFormChange('category', e.target.value)}>
                    <option value="raw">Raw Materials</option>
                    <option value="beverage">Beverages</option>
                    <option value="packaging">Packaging</option>
                    <option value="cleaning">Cleaning</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Unit</label>
                  <input type="text" value={formData.unit} onChange={(e) => handleFormChange('unit', e.target.value)} placeholder="kg, pcs, bottle" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Current Stock</label>
                  <input type="number" value={formData.stock} onChange={(e) => handleFormChange('stock', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Minimum Stock</label>
                  <input type="number" value={formData.minStock} onChange={(e) => handleFormChange('minStock', e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Unit Price (Rs.)</label>
                  <input type="number" value={formData.price} onChange={(e) => handleFormChange('price', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Supplier</label>
                  <input type="text" value={formData.supplier} onChange={(e) => handleFormChange('supplier', e.target.value)} placeholder="Supplier name" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveItem}>{selectedItem ? 'Update Item' : 'Add Item'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
