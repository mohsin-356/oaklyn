import { useEffect, useMemo, useRef, useState } from 'react'
import { StorageKeys, addItem, listItems, updateItem, deleteItem, listTypesForCategory, addTypeForCategory } from '../utils/storage.js'

const CATEGORY_CONFIG = {
  foods: { title: 'Food', types: ['Burger','Wings','Fries','Wrap','Chicken','Strips','Cheese Balls','Nuggets'], includeImage: true },
  deals: { title: 'Deals', types: ['Deal','Deal#1','Deal#2','Deal#3','Deal#4','Family Bag Share','Super Family Bag Share'], includeImage: true },
  drinks: { title: 'Drinks', types: ['Soda','Juice','Coffee','Tea','Water'], includeImage: true },
  extras: { title: 'Extras', types: ['Sauce','Topping','Side'], includeImage: true },
}

const CAT_KEYS = Object.keys(CATEGORY_CONFIG)

export default function AddItems() {
  console.log('[AddItems] Component starting render')
  
  const [category, setCategory] = useState('foods')
  const [allItems, setAllItems] = useState([])
  const [extraTypes, setExtraTypes] = useState([])
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('grid')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [showPanel, setShowPanel] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [overflowOpen, setOverflowOpen] = useState(null)
  const [renderError, setRenderError] = useState(null)
  const overflowRef = useRef(null)

  // Catch any render errors
  useEffect(() => {
    window.addEventListener('error', (e) => {
      console.error('Global error caught:', e.error)
      setRenderError(e.error?.message || 'Unknown error')
    })
  }, [])
  
  console.log('[AddItems] Hooks initialized')

  const cfg = useMemo(() => CATEGORY_CONFIG[category], [category])

  const mergedTypes = useMemo(() => {
    const normalize = (t) => {
      if (typeof t === 'string') return t
      if (t && typeof t === 'object') return t.label || t.name || t.type || String(t)
      return String(t)
    }
    const all = [...(cfg.types||[]), ...(extraTypes||[])].map(normalize).filter(Boolean)
    const set = new Set(all)
    return Array.from(set)
  }, [cfg.types, extraTypes])

  // Load all items across categories
  const loadAll = async () => {
    const results = await Promise.all(CAT_KEYS.map(k => listItems(StorageKeys[k]).catch(()=>[])))
    const flat = results.flat()
    setAllItems(flat)
  }

  useEffect(() => { loadAll() }, [])

  useEffect(() => {
    listTypesForCategory(category).then(r => setExtraTypes(r)).catch(()=>{})
  }, [category])

  // Close overflow on outside click
  useEffect(() => {
    const onClick = (e) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target)) setOverflowOpen(null)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const itemsForCategory = useMemo(() => allItems.filter(i => {
    const cat = (i.category || '').toLowerCase()
    return cat === category || cat === cfg.title.toLowerCase() || cat === cfg.title
  }), [allItems, category, cfg.title])

  const filteredItems = useMemo(() => {
    let list = itemsForCategory
    if (search.trim()) {
      const q = search.toLowerCase()
      list = allItems.filter(i =>
        (i.name||'').toLowerCase().includes(q) ||
        (i.type||'').toLowerCase().includes(q)
      )
    }
    return list
  }, [itemsForCategory, allItems, search])

  const catCounts = useMemo(() => {
    const counts = {}
    CAT_KEYS.forEach(k => {
      const title = CATEGORY_CONFIG[k].title.toLowerCase()
      counts[k] = allItems.filter(i => {
        const c = (i.category || '').toLowerCase()
        return c === k || c === title || c === CATEGORY_CONFIG[k].title
      }).length
    })
    return counts
  }, [allItems])

  const openAdd = () => { setEditingItem(null); setShowPanel(true) }
  const openEdit = (item) => { setEditingItem(item); setShowPanel(true) }
  const closePanel = () => { setShowPanel(false); setEditingItem(null) }

  const handleSave = async (data) => {
    try {
      if (editingItem) {
        const result = await updateItem(StorageKeys[category], { ...editingItem, ...data })
        if (result && result.error) { alert('Failed to update: ' + result.error); return }
      } else {
        const created = await addItem(StorageKeys[category], data)
        if (created && created.error) { alert('Failed to create: ' + created.error); return }
      }
      // Reload all items from DB to ensure consistency
      await loadAll()
      closePanel()
    } catch (e) {
      console.error('handleSave error:', e)
      alert('Failed to save item: ' + (e?.message || 'Unknown error'))
    }
  }

  const handleDelete = async (id) => {
    const sid = String(id || '')
    const result = await deleteItem(StorageKeys[category], sid)
    if (result && result.error) { alert('Failed to delete: ' + result.error); return }
    // Reload all items from DB to ensure consistency
    await loadAll()
    setSelectedIds(prev => { const n = new Set(Array.from(prev).map(x => String(x || ''))); n.delete(sid); return n })
    setOverflowOpen(null)
  }

  const toggleAvailable = async (item) => {
    const next = !isAvailable(item)
    const result = await updateItem(StorageKeys[category], { ...item, available: next })
    if (result && result.error) { alert('Failed to toggle: ' + result.error); return }
    await loadAll()
  }

  const isAvailable = (item) => item.available !== false

  const toggleSelect = (id) => {
    const sid = String(id || '')
    setSelectedIds(prev => {
      const n = new Set(Array.from(prev).map(x => String(x || '')))
      if (n.has(sid)) n.delete(sid); else n.add(sid)
      return n
    })
  }

  const selectAll = () => {
    if (selectedIds.size === filteredItems.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredItems.map(i => String(i.id || i._id || ''))))
  }

  const bulkAvailable = async (val) => {
    const ids = Array.from(selectedIds).map(x => String(x || ''))
    await Promise.all(ids.map(sid => {
      const item = allItems.find(i => String(i.id || '') === sid || String(i._id || '') === sid)
      if (!item) return Promise.resolve()
      const catKey = CAT_KEYS.find(k => {
        const t = CATEGORY_CONFIG[k].title.toLowerCase()
        const c = (item.category || '').toLowerCase()
        return c === k || c === t
      }) || category
      return updateItem(StorageKeys[catKey], { ...item, available: val })
    }))
    setAllItems(prev => prev.map(i => ids.includes(String(i.id || i._id || '')) ? { ...i, available: val } : i))
    setSelectedIds(new Set())
  }

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} items?`)) return
    const ids = Array.from(selectedIds).map(x => String(x || ''))
    await Promise.all(ids.map(sid => {
      const item = allItems.find(i => String(i.id || '') === sid || String(i._id || '') === sid)
      if (!item) return Promise.resolve()
      const catKey = CAT_KEYS.find(k => {
        const t = CATEGORY_CONFIG[k].title.toLowerCase()
        const c = (item.category || '').toLowerCase()
        return c === k || c === t
      }) || category
      return deleteItem(StorageKeys[catKey], sid)
    }))
    setAllItems(prev => prev.filter(i => !ids.includes(String(i.id || i._id || ''))))
    setSelectedIds(new Set())
  }

  const handleAddType = async (t) => {
    const arr = await addTypeForCategory(category, t)
    setExtraTypes(arr)
  }

  if (renderError) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>
        <h2>Error Loading Page</h2>
        <p>{renderError}</p>
        <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', marginTop: 20 }}>Reload</button>
      </div>
    )
  }

  return (
    <section className="menu-page">
      {/* Sidebar */}
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
              <span className="menu-cat-count">{catCounts[key] || 0}</span>
            </button>
          ))}
        </nav>
        <div style={{marginTop:'auto', padding:'16px 20px'}}>
          <button className="menu-add-cat" onClick={()=>setShowAddCat(true)}>+ Add Category</button>
        </div>
      </aside>

      {/* Main */}
      <div className="menu-main">
        {/* Header */}
        <div className="menu-header">
          <div className="menu-header-top">
            <h1 className="menu-title">{search.trim() ? `Search: "${search}"` : cfg.title}</h1>
            <div className="menu-header-actions">
              <div className="menu-search">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input placeholder="Search items..." value={search} onChange={e=>setSearch(e.target.value)} />
              </div>
              <div className="menu-view-toggle">
                <button className={viewMode==='grid'?'active':''} onClick={()=>setViewMode('grid')} title="Grid">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                    <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
                  </svg>
                </button>
                <button className={viewMode==='list'?'active':''} onClick={()=>setViewMode('list')} title="List">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                  </svg>
                </button>
              </div>
              <button className="menu-add-btn" onClick={openAdd}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add New Item
              </button>
            </div>
          </div>

          {/* Bulk bar */}
          {selectedIds.size > 0 && (
            <div className="menu-bulk-bar">
              <span className="menu-bulk-count">{selectedIds.size} selected</span>
              <div className="menu-bulk-actions">
                <button className="menu-bulk-btn" onClick={()=>bulkAvailable(true)}>Mark Available</button>
                <button className="menu-bulk-btn" onClick={()=>bulkAvailable(false)}>Mark Unavailable</button>
                <button className="menu-bulk-btn danger" onClick={bulkDelete}>Delete</button>
                <button className="menu-bulk-btn ghost" onClick={()=>setSelectedIds(new Set())}>Clear</button>
              </div>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="menu-items-wrap">
          {filteredItems.length === 0 ? (
            <div className="menu-empty">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <div>No items found</div>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="menu-grid">
              {filteredItems.map(item => (
                <div key={String(item.id || item._id || Math.random())} className={`menu-card ${!isAvailable(item) ? 'unavailable' : ''}`}>
                  <label className="menu-card-check">
                    <input type="checkbox" checked={selectedIds.has(String(item.id || item._id || ''))} onChange={()=>toggleSelect(item.id || item._id)} />
                  </label>
                  <div className="menu-card-img">
                    {item.img ? <img src={item.img} alt={item.name} onError={e=>{e.currentTarget.style.display='none'}} /> : <div className="menu-card-img-placeholder">{item.name?.charAt(0)}</div>}
                  </div>
                  <div className="menu-card-info">
                    <div className="menu-card-name">{item.name}</div>
                    <div className="menu-card-tag">{item.type || item.category}</div>
                    <div className="menu-card-price">Rs.{Number(item.price).toFixed(2)}</div>
                  </div>
                  <div className="menu-card-actions">
                    <label className="menu-toggle" title={isAvailable(item)?'Available':'Unavailable'}>
                      <input type="checkbox" checked={isAvailable(item)} onChange={()=>toggleAvailable(item)} />
                      <span className="menu-toggle-slider" />
                    </label>
                    <button className="menu-card-edit" onClick={()=>openEdit(item)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <div className="menu-overflow-wrap" ref={overflowOpen === String(item.id||item._id||'') ? overflowRef : null}>
                      <button className="menu-card-more" onClick={()=>setOverflowOpen(overflowOpen===String(item.id||item._id||'')?null:String(item.id||item._id||''))}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                      </button>
                      {overflowOpen === String(item.id||item._id||'') && (
                        <div className="menu-overflow-menu">
                          <button className="menu-overflow-item danger" onClick={()=>{handleDelete(item.id||item._id);setOverflowOpen(null)}}>Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="menu-list">
              <div className="menu-list-head">
                <label className="menu-list-check">
                  <input type="checkbox" checked={filteredItems.length > 0 && selectedIds.size === filteredItems.length} onChange={selectAll} />
                </label>
                <span className="menu-list-col img">Image</span>
                <span className="menu-list-col name">Name</span>
                <span className="menu-list-col type">Category</span>
                <span className="menu-list-col price">Price</span>
                <span className="menu-list-col status">Status</span>
                <span className="menu-list-col actions">Actions</span>
              </div>
              {filteredItems.map(item => (
                <div key={String(item.id || item._id || Math.random())} className={`menu-list-row ${!isAvailable(item)?'unavailable':''}`}>
                  <label className="menu-list-check">
                    <input type="checkbox" checked={selectedIds.has(String(item.id || item._id || ''))} onChange={()=>toggleSelect(item.id || item._id)} />
                  </label>
                  <div className="menu-list-col img">
                    <div className="menu-list-thumb">
                      {item.img ? <img src={item.img} alt={item.name} onError={e=>{e.currentTarget.style.display='none'}} /> : <div className="menu-list-thumb-placeholder">{item.name?.charAt(0)}</div>}
                    </div>
                  </div>
                  <div className="menu-list-col name">{item.name}</div>
                  <div className="menu-list-col type"><span className="menu-list-tag">{item.type || item.category}</span></div>
                  <div className="menu-list-col price">Rs.{Number(item.price).toFixed(2)}</div>
                  <div className="menu-list-col status">
                    <label className="menu-toggle" title={isAvailable(item)?'Available':'Unavailable'}>
                      <input type="checkbox" checked={isAvailable(item)} onChange={()=>toggleAvailable(item)} />
                      <span className="menu-toggle-slider" />
                    </label>
                  </div>
                  <div className="menu-list-col actions">
                    <button className="menu-list-edit" onClick={()=>openEdit(item)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <div className="menu-overflow-wrap">
                      <button className="menu-list-more" onClick={()=>setOverflowOpen(overflowOpen===String(item.id||item._id||'')?null:String(item.id||item._id||''))}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                      </button>
                      {overflowOpen === String(item.id||item._id||'') && (
                        <div className="menu-overflow-menu">
                          <button className="menu-overflow-item danger" onClick={()=>{handleDelete(item.id||item._id);setOverflowOpen(null)}}>Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Slide-over Panel */}
      {showPanel && (
        <PanelRenderer
          editingItem={editingItem}
          category={category}
          cfgTitle={cfg?.title}
          mergedTypes={mergedTypes}
          handleSave={handleSave}
          closePanel={closePanel}
          handleAddType={handleAddType}
        />
      )}

      {/* Add Category Modal */}
      {showAddCat && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={()=>setShowAddCat(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="card-title">Add Category</div>
            <input className="input" placeholder="Category name" value={newCatName} onChange={e=>setNewCatName(e.target.value)} autoFocus />
            <div className="actions" style={{justifyContent:'flex-end', marginTop:12}}>
              <button className="btn" onClick={()=>setShowAddCat(false)}>Cancel</button>
              <button className="btn primary" onClick={()=>{
                const t = newCatName.trim()
                if (t) handleAddType(t)
                setShowAddCat(false)
                setNewCatName('')
              }}>Add</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// Wrapper component to catch ItemPanel errors
function PanelRenderer({ editingItem, category, cfgTitle, mergedTypes, handleSave, closePanel, handleAddType }) {
  const [error, setError] = useState(null)
  
  if (error) {
    return (
      <div className="menu-panel-overlay" onClick={closePanel}>
        <div className="menu-panel" onClick={e=>e.stopPropagation()} style={{ padding: 20 }}>
          <h3>Error in Panel</h3>
          <p style={{ color: '#ef4444' }}>{error}</p>
          <button className="btn" onClick={closePanel}>Close</button>
        </div>
      </div>
    )
  }
  
  try {
    console.log('[PanelRenderer] Rendering with typeOptions:', mergedTypes)
    return (
      <div className="menu-panel-overlay" onClick={closePanel}>
        <div className="menu-panel" onClick={e=>e.stopPropagation()}>
          <div className="menu-panel-header">
            <h2>{editingItem ? 'Edit Item' : 'Add New Item'}</h2>
            <button className="menu-panel-close" onClick={closePanel}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <ItemPanel
            initial={editingItem}
            categoryKey={category}
            categoryTitle={cfgTitle}
            typeOptions={mergedTypes}
            onSave={handleSave}
            onCancel={closePanel}
            onAddType={handleAddType}
          />
        </div>
      </div>
    )
  } catch (e) {
    console.error('[PanelRenderer] Error:', e)
    setError(e.message || 'Unknown error')
    return null
  }
}

function ItemPanel({ initial, categoryKey, categoryTitle, typeOptions, onSave, onCancel, onAddType }) {
  console.log('[ItemPanel] Rendering with typeOptions:', typeOptions)
  // Ensure typeOptions is always a safe array
  const safeTypeOptions = Array.isArray(typeOptions) ? typeOptions : []
  
  const [form, setForm] = useState({
    name: '', price: '', type: '', img: '', description: '', available: true, taxPercent: ''
  })
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || '',
        price: String(initial.price ?? ''),
        type: initial.type || '',
        img: initial.img || '',
        description: initial.description || '',
        available: initial.available !== false,
        taxPercent: String(initial.taxPercent ?? ''),
      })
    }
  }, [initial])

  const handleImageFile = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm(f => ({ ...f, img: reader.result }))
    reader.readAsDataURL(file)
  }

  const submit = (e) => {
    e.preventDefault()
    const priceNum = parseFloat(form.price)
    if (!form.name.trim() || isNaN(priceNum)) return
    const payload = {
      name: form.name.trim(),
      price: priceNum,
      type: form.type,
      img: form.img,
      description: form.description.trim(),
      available: form.available,
      taxPercent: form.taxPercent ? parseFloat(form.taxPercent) : undefined,
    }
    onSave?.(payload)
  }

  return (
    <form className="menu-panel-body" onSubmit={submit}>
      <div className="menu-panel-row">
        <label className="menu-field">
          <span>Name</span>
          <input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required />
        </label>
        <label className="menu-field">
          <span>Price (Rs.)</span>
          <input className="input" type="number" step="0.01" min="0" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))} required />
        </label>
      </div>

      <div className="menu-panel-row">
        <label className="menu-field">
          <span>Category</span>
          <input className="input" value={categoryTitle} disabled style={{opacity:0.7}} />
        </label>
        <label className="menu-field">
          <span>Subcategory</span>
          <div className="menu-field-row">
            <select className="input" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
              <option value="">Select type</option>
              {safeTypeOptions.map((t, i)=> {
                const label = typeof t === 'string' ? t : (t?.label || t?.name || t?.type || String(t || ''))
                if (!label) return null
                return <option key={`${label}-${i}`} value={label}>{label}</option>
              }).filter(Boolean)}
            </select>
            <button type="button" className="btn" onClick={()=>{setNewTypeName('');setShowTypeModal(true)}}>+ Type</button>
          </div>
        </label>
      </div>

      <label className="menu-field">
        <span>Description</span>
        <textarea className="input" rows={3} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Optional description..." />
      </label>

      <div className="menu-panel-row">
        <label className="menu-field">
          <span>Tax %</span>
          <input className="input" type="number" step="0.1" min="0" value={form.taxPercent} onChange={e=>setForm(f=>({...f,taxPercent:e.target.value}))} placeholder="e.g. 5" />
        </label>
        <label className="menu-field menu-toggle-field">
          <span>Available</span>
          <label className="menu-toggle-lg">
            <input type="checkbox" checked={form.available} onChange={e=>setForm(f=>({...f,available:e.target.checked}))} />
            <span className="menu-toggle-slider" />
          </label>
        </label>
      </div>

      <label className="menu-field">
        <span>Image</span>
        <div className="menu-field-row">
          <input className="input" placeholder="https://..." value={form.img} onChange={e=>setForm(f=>({...f,img:e.target.value}))} />
          <label className="btn">
            Upload
            <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleImageFile(e.target.files?.[0])} />
          </label>
        </div>
        {form.img && (
          <div style={{marginTop:8}}>
            <img src={form.img} alt="preview" style={{height:100, borderRadius:10, objectFit:'cover'}} onError={e=>{e.currentTarget.style.display='none'}} />
          </div>
        )}
      </label>

      <div className="menu-panel-actions">
        <button className="btn primary" type="submit">{initial ? 'Update Item' : 'Add Item'}</button>
        <button className="btn" type="button" onClick={onCancel}>Cancel</button>
      </div>

      {showTypeModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" onClick={()=>setShowTypeModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="card-title">Add New Type</div>
            <input className="input" placeholder="e.g., Salad" value={newTypeName} onChange={e=>setNewTypeName(e.target.value)} autoFocus
              onKeyDown={e=>{
                if (e.key==='Enter'){ const t=(newTypeName||'').trim(); if(t){onAddType?.(t);setForm(f=>({...f,type:t}))} setShowTypeModal(false);setNewTypeName('') }
                else if (e.key==='Escape') setShowTypeModal(false)
              }}
            />
            <div className="actions" style={{justifyContent:'flex-end', marginTop:10}}>
              <button className="btn" type="button" onClick={()=>setShowTypeModal(false)}>Cancel</button>
              <button className="btn primary" type="button" onClick={()=>{ const t=(newTypeName||'').trim(); if(t){onAddType?.(t);setForm(f=>({...f,type:t}))} setShowTypeModal(false);setNewTypeName('') }}>Save</button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
