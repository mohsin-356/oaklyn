import { useState, useEffect, useRef } from 'react'
import { StorageKeys, addItem, addItemsBulk, listItems, updateItem, deleteItem, listTypesForCategory, addTypeForCategory } from '../utils/storage.js'
import * as db from '../services/db.js'
import ImageUploader from '../components/ImageUploader'

const CATEGORY_CONFIG = {
  foods: { title: 'Food', types: ['Burger','Wings','Fries','Wrap','Chicken','Strips','Cheese Balls','Nuggets'], includeImage: true },
  deals: { title: 'Deals', types: ['Deal','Deal#1','Deal#2','Deal#3','Deal#4','Family Bag Share','Super Family Bag Share'], includeImage: true },
  drinks: { title: 'Drinks', types: ['Soda','Juice','Coffee','Tea','Water'], includeImage: true },
  extras: { title: 'Extras', types: ['Sauce','Topping','Side'], includeImage: true },
}

const CAT_KEYS = Object.keys(CATEGORY_CONFIG)

export default function AddItems() {
  const [category, setCategory] = useState('foods')
  const [allItems, setAllItems] = useState([])
  const [extraTypes, setExtraTypes] = useState([])
  const [search, setSearch] = useState('')
  const [showPanel, setShowPanel] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)

  const cfg = CATEGORY_CONFIG[category]
  
  const mergedTypes = [...(cfg.types || []), ...(extraTypes || [])]

  const loadAllItems = async () => {
    const results = await Promise.all(CAT_KEYS.map(k => listItems(StorageKeys[k]).catch(() => [])))
    setAllItems(results.flat())
  }

  useEffect(() => {
    console.log('[AddItems] Loading items...')
    loadAllItems()
      .then(() => {
        console.log('[AddItems] Loaded', (allItems || []).length, 'items')
      })
      .catch(err => {
        console.error('[AddItems] Load error:', err)
        setErrorMsg('Failed to load items: ' + err.message)
      })
  }, [])

  useEffect(() => {
    if (!category) return
    console.log('[AddItems] Loading types for', category)
    listTypesForCategory(category).catch(() => []).then(arr => {
      console.log('[AddItems] Loaded types:', arr)
      setExtraTypes(arr || [])
    })
  }, [category])

  const itemsForCategory = allItems.filter(i => {
    const cat = (i.category || '').toLowerCase()
    return cat === category || cat === cfg.title.toLowerCase()
  })

  const filteredItems = search.trim() 
    ? allItems.filter(i => (i.name || '').toLowerCase().includes(search.toLowerCase()))
    : itemsForCategory

  const openAdd = () => { 
    console.log('[AddItems] Opening add panel')
    setEditingItem(null)
    setShowPanel(true)
  }
  
  const openEdit = (item) => { 
    console.log('[AddItems] Opening edit panel for', item)
    setEditingItem(item)
    setShowPanel(true)
  }
  
  const closePanel = () => {
    console.log('[AddItems] Closing panel')
    setShowPanel(false)
    setEditingItem(null)
  }

  const handleSave = async (data) => {
    console.log('[AddItems] Saving:', data)
    try {
      if (editingItem) {
        const nextCategoryKey = data?.categoryKey || category
        const nextCategoryTitle = CATEGORY_CONFIG[nextCategoryKey]?.title || cfg.title
        const result = await updateItem(StorageKeys[nextCategoryKey], { ...editingItem, ...data, category: nextCategoryTitle })
        if (result && result.error) { alert('Failed to update: ' + result.error); return }
        if (nextCategoryKey !== category) setCategory(nextCategoryKey)
      } else {
        const newItem = await addItem(StorageKeys[category], { ...data, category })
        if (newItem && newItem.error) { alert('Failed to create: ' + newItem.error); return }
      }
      // Reload all items from DB to ensure consistency
      const results = await Promise.all(CAT_KEYS.map(k => listItems(StorageKeys[k]).catch(()=>[])))
      setAllItems(results.flat())
      closePanel()
    } catch (err) {
      console.error('[AddItems] Save error:', err)
      alert('Error saving: ' + err.message)
    }
  }

  const handleDelete = async (item) => {
    if (!confirm('Delete this item?')) return
    try {
      const sid = String(item.id || item._id || '')
      const result = await deleteItem(StorageKeys[category], sid)
      if (result && result.error) { alert('Failed to delete: ' + result.error); return }
      // Reload all items from DB to ensure consistency
      const results = await Promise.all(CAT_KEYS.map(k => listItems(StorageKeys[k]).catch(()=>[])))
      setAllItems(results.flat())
    } catch (err) {
      alert('Error deleting: ' + err.message)
    }
  }

  const handleAddType = async (t) => {
    const arr = await addTypeForCategory(category, t)
    setExtraTypes(arr || [])
  }

  if (errorMsg) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
        <h2>Error</h2>
        <p>{errorMsg}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    )
  }

  return (
    <section className="menu-page">
      <aside className="menu-sidebar">
        <div className="menu-sidebar-header">Menu</div>
        <nav className="menu-cat-list">
          {CAT_KEYS.map(key => (
            <button
              key={key}
              className={`menu-cat-item ${category === key ? 'active' : ''}`}
              onClick={() => { setCategory(key); setSearch('') }}
            >
              <span className="menu-cat-label">{CATEGORY_CONFIG[key].title}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className="menu-main">
        <div className="menu-header">
          <div className="menu-header-top">
            <h1 className="menu-title">{cfg.title}</h1>
            <div className="menu-header-actions">
              <input 
                placeholder="Search..." 
                value={search} 
                onChange={e => setSearch(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <button className="menu-add-btn" onClick={openAdd}>
                + Add New Item
              </button>
              <button className="menu-add-btn" onClick={() => setShowImportModal(true)} style={{ background: '#64748b' }}>
                Import
              </button>
            </div>
          </div>
        </div>

        <div className="menu-items-wrap">
          {filteredItems.length === 0 ? (
            <div className="menu-empty">No items found</div>
          ) : (
            <div className="menu-grid">
              {filteredItems.map(item => (
                <div key={String(item.id || item._id || Math.random())} className="menu-card">
                  <div className="menu-card-img" style={{ width: '100%', height: 140, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                    {item.img || item.image ? (
                      <img 
                        src={(() => {
                          const img = item.img || item.image || ''
                          // Handle Express server URLs like http://localhost:3001/uploads/...
                          if (img.startsWith('http://') || img.startsWith('https://')) return img
                          if (img.startsWith('data:')) return img
                          if (img.startsWith('upload://')) return img
                          if (img.startsWith('/uploads/')) return `upload://${img.replace('/uploads/', '')}`
                          return img
                        })()} 
                        alt={item.name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={e => { 
                          e.currentTarget.style.display = 'none'; 
                          e.currentTarget.parentElement.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#f1f5f9;color:#94a3b8;font-size:24px">${item.name?.charAt(0) || '?'}</div>`; 
                        }} 
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#94a3b8', fontSize: 24, fontWeight: 600 }}>{item.name?.charAt(0) || '?'}</div>
                    )}
                  </div>
                  <div className="menu-card-info">
                    <div className="menu-card-name">{item.name || 'Unnamed'}</div>
                    <div className="menu-card-tag">{item.type || item.category}</div>
                    <div className="menu-card-price">Rs.{Number(item.price || 0).toFixed(2)}</div>
                  </div>
                  <div className="menu-card-actions">
                    <button className="menu-card-btn" onClick={() => openEdit(item)}>Edit</button>
                    <button className="menu-card-btn danger" onClick={() => handleDelete(item)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showPanel && (
        <SimpleItemPanel
          editingItem={editingItem}
          categoryKey={category}
          typeOptions={mergedTypes}
          onSave={handleSave}
          onCancel={closePanel}
          onAddType={handleAddType}
        />
      )}

      {showImportModal && (
        <ImportModal
          category={category}
          onClose={() => setShowImportModal(false)}
          onImportSuccess={loadAllItems}
        />
      )}
    </section>
  )
}

function SimpleItemPanel({ editingItem, categoryKey, typeOptions, onSave, onCancel, onAddType }) {
  const normalizeCategoryKey = (raw) => {
    const v = String(raw || '').toLowerCase()
    if (!v) return categoryKey
    const found = CAT_KEYS.find(k => {
      const t = String(CATEGORY_CONFIG[k]?.title || '').toLowerCase()
      return v === k || v === t
    })
    return found || categoryKey
  }

  const [form, setForm] = useState({
    name: editingItem?.name || '',
    price: String(editingItem?.price ?? ''),
    type: editingItem?.type || '',
    img: editingItem?.img || editingItem?.image || '', // Support both img and image fields
    description: editingItem?.description || '',
    available: editingItem?.available !== false,
    categoryKey: normalizeCategoryKey(editingItem?.category),
  })
  const [newType, setNewType] = useState('')
  const [showAddType, setShowAddType] = useState(false)
  const nameInputRef = useRef(null)

  // Auto-focus name input when panel opens
  useEffect(() => {
    if (nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 100)
    }
  }, [])

  // Sync form when editingItem changes
  useEffect(() => {
    if (editingItem) {
      setForm({
        name: editingItem.name || '',
        price: String(editingItem.price ?? ''),
        type: editingItem.type || '',
        img: editingItem.img || editingItem.image || '',
        description: editingItem.description || '',
        available: editingItem.available !== false,
        categoryKey: normalizeCategoryKey(editingItem?.category),
      })
    }
  }, [editingItem])

  // Image is now stored as base64 in form.img - no server needed

  const handleSubmit = (e) => {
    e.preventDefault()
    const price = parseFloat(form.price)
    if (!form.name.trim() || isNaN(price)) {
      alert('Please enter name and valid price')
      return
    }
    onSave({
      name: form.name.trim(),
      price,
      type: form.type,
      img: form.img,
      image: form.img, // Save to both fields for compatibility
      description: form.description.trim(),
      available: form.available,
      categoryKey: form.categoryKey,
    })
  }

  const safeTypeOptions = Array.isArray(typeOptions) ? typeOptions : []

  return (
    <div className="menu-panel-overlay" onClick={onCancel}>
      <div className="menu-panel" onClick={e => e.stopPropagation()}>
        <div className="menu-panel-header">
          <h2>{editingItem ? 'Edit Item' : 'Add New Item'}</h2>
          <button className="menu-panel-close" onClick={onCancel}>×</button>
        </div>
        <form className="menu-panel-body" onSubmit={handleSubmit}>
          <div className="menu-panel-row">
            <label className="menu-field">
              <span>Name</span>
              <input
                ref={nameInputRef}
                className="input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                autoComplete="off"
                required
              />
            </label>
            <label className="menu-field">
              <span>Price (Rs.)</span>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                autoComplete="off"
                required
              />
            </label>
          </div>

          <div className="menu-panel-row">
            <label className="menu-field">
              <span>Category</span>
              <select 
                className="input" 
                value={form.categoryKey} 
                onChange={e => setForm(f => ({ ...f, categoryKey: e.target.value }))}
              >
                {CAT_KEYS.map(k => (
                  <option key={k} value={k}>{CATEGORY_CONFIG[k]?.title || k}</option>
                ))}
              </select>
            </label>
            <label className="menu-field">
              <span>Type</span>
              <div className="menu-field-row">
                <select 
                  className="input" 
                  value={form.type} 
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="">Select type</option>
                  {safeTypeOptions.map((t, i) => (
                    <option key={i} value={t}>{t}</option>
                  ))}
                </select>
                <button type="button" className="btn" onClick={() => setShowAddType(true)}>+</button>
              </div>
            </label>
          </div>

          <label className="menu-field">
            <span>Description</span>
            <textarea
              className="input"
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              autoComplete="off"
            />
          </label>

          <label className="menu-field">
            <span>Image</span>
            <ImageUploader
              currentImage={form.img}
              onImageChange={(base64) => setForm(f => ({ ...f, img: base64 }))}
              itemName={form.name}
              size={120}
            />
          </label>

          <label className="menu-field menu-toggle-field" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>Available</span>
            <input 
              type="checkbox" 
              checked={form.available} 
              onChange={e => setForm(f => ({ ...f, available: e.target.checked }))}
            />
          </label>

          <div className="menu-panel-actions" style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" className="btn" onClick={onCancel} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button
              type="submit"
              className="btn primary"
              style={{
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                background: '#0BAD95',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              Save
            </button>
          </div>
        </form>

        {showAddType && (
          <div className="modal-overlay" onClick={() => setShowAddType(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="card-title">Add New Type</div>
              <input
                className="input"
                placeholder="Type name"
                value={newType}
                onChange={e => setNewType(e.target.value)}
                autoComplete="off"
              />
              <div className="actions" style={{ marginTop: 12 }}>
                <button className="btn" onClick={() => setShowAddType(false)}>Cancel</button>
                <button className="btn primary" onClick={() => {
                  const t = newType.trim()
                  if (t) {
                    onAddType?.(t)
                    setForm(f => ({ ...f, type: t }))
                  }
                  setShowAddType(false)
                  setNewType('')
                }}>Add</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ImportModal({ category, onClose, onImportSuccess }) {
  const [file, setFile] = useState(null)
  const [previewData, setPreviewData] = useState(null)
  const [fullData, setFullData] = useState(null)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) throw new Error('CSV must have header and at least one data row')
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    return lines.slice(1).map(line => {
      const values = line.split(',')
      const obj = {}
      headers.forEach((h, i) => {
        obj[h] = values[i]?.trim() || ''
      })
      return obj
    })
  }

  const parseJSON = (text) => {
    const data = JSON.parse(text)
    if (!Array.isArray(data)) throw new Error('JSON must be an array of items')
    return data
  }

  const parseExcel = (text) => {
    // Simple TSV/Excel paste support (tab-separated)
    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) throw new Error('File must have header and at least one data row')
    const delimiter = text.includes('\t') ? '\t' : ','
    const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase())
    return lines.slice(1).map(line => {
      const values = line.split(delimiter)
      const obj = {}
      headers.forEach((h, i) => {
        obj[h] = values[i]?.trim() || ''
      })
      return obj
    })
  }

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError(null)
    setResult(null)
    
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target.result
        let data = []
        
        if (f.name.endsWith('.json')) {
          data = parseJSON(text)
        } else if (f.name.endsWith('.csv')) {
          data = parseCSV(text)
        } else if (f.name.endsWith('.xlsx') || f.name.endsWith('.xls')) {
          data = parseExcel(text)
        } else {
          // Try auto-detect
          try {
            data = parseJSON(text)
          } catch {
            data = parseCSV(text)
          }
        }
        
        // Normalize data (basic fields only; missing optional fields will be empty and can be updated later)
        const normalized = data.map(item => ({
          name: String(item?.name || item?.Name || item?.item || item?.Item || '').trim(),
          price: parseFloat(item?.price ?? item?.Price ?? item?.amount ?? item?.Amount ?? 0),
          type: String(item?.type || item?.Type || '').trim(),
          description: String(item?.description || item?.Description || item?.desc || item?.Desc || '').trim(),
          img: String(item?.img || item?.image || item?.Image || item?.url || item?.URL || '').trim(),
          available: !(item?.available === 'false' || item?.available === false || item?.isAvailable === false),
        })).filter(item => item.name)

        setFullData(normalized)
        setPreviewData(normalized.slice(0, 10))
      } catch (err) {
        setError('Failed to parse file: ' + err.message)
        setPreviewData(null)
        setFullData(null)
      }
    }
    reader.readAsText(f)
  }

  const handleImport = async () => {
    if (!fullData || fullData.length === 0) return
    setImporting(true)
    try {
      const res = await addItemsBulk(StorageKeys[category], fullData)
      setResult(res)
      if (!res) {
        alert('Import failed: No response from database. Please restart the app and try again.')
        return
      }

      if (res.insertedCount > 0) {
        const errCount = Array.isArray(res.errors) ? res.errors.length : 0
        alert(`Successfully imported ${res.insertedCount} items${errCount ? ` (Failed: ${errCount})` : ''}!`)
        onImportSuccess?.()
        onClose()
        return
      }

      const errCount = Array.isArray(res.errors) ? res.errors.length : 0
      alert(`No items were imported.${errCount ? ` Errors: ${errCount}` : ''}`)
    } catch (err) {
      setError('Import failed: ' + err.message)
      alert('Import failed: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, maxHeight: '80vh', overflow: 'auto' }}>
        <div className="card-title">Bulk Import Items</div>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
          Upload CSV, JSON, or Excel file. Required columns: name, price. Optional: type, img, description
        </p>
        
        <input 
          type="file" 
          accept=".csv,.json,.xlsx,.xls,.txt" 
          onChange={handleFileChange}
          style={{ marginBottom: 16 }}
        />
        
        {error && (
          <div style={{ color: '#ef4444', padding: 12, background: '#fef2f2', borderRadius: 8, marginBottom: 16 }}>
            {error}
          </div>
        )}
        
        {previewData && previewData.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ marginBottom: 8 }}>Preview (first {previewData.length} of {fullData?.length || previewData.length})</h4>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: 8, textAlign: 'left' }}>Name</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Price</th>
                  <th style={{ padding: 8, textAlign: 'left' }}>Type</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((item, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: 8 }}>{item.name}</td>
                    <td style={{ padding: 8 }}>Rs.{item.price}</td>
                    <td style={{ padding: 8 }}>{item.type || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {result && Array.isArray(result.errors) && result.errors.length > 0 && (
          <div style={{ color: '#b45309', padding: 12, background: '#fffbeb', borderRadius: 8, marginBottom: 16 }}>
            Imported with warnings. Some rows failed.
          </div>
        )}
        
        <div className="actions" style={{ justifyContent: 'flex-end', gap: 12 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button 
            className="btn primary" 
            onClick={handleImport} 
            disabled={!fullData || fullData.length === 0 || importing}
          >
            {importing ? 'Importing...' : `Import ${fullData?.length || 0} Items`}
          </button>
        </div>
      </div>
    </div>
  )
}
