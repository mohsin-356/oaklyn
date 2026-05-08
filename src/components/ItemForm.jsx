import { useEffect, useState } from 'react'

export default function ItemForm({ initial, onSubmit, onCancel, typeOptions, includeImage = false, onAddType }) {
  const [form, setForm] = useState({ name: '', price: '', type: '', img: '' })
  const [showTypeModal, setShowTypeModal] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')

  useEffect(() => {
    if (initial) setForm({ name: initial.name || '', price: String(initial.price ?? ''), type: initial.type || '', img: initial.img || '' })
  }, [initial])

  const handleSubmit = (e) => {
    e.preventDefault()
    const priceNum = parseFloat(form.price)
    if (!form.name.trim() || isNaN(priceNum)) return
    const payload = { ...initial, name: form.name.trim(), price: priceNum, type: form.type }
    if (includeImage && form.img) payload.img = form.img
    onSubmit?.(payload)
  }

  const handleImageFile = async (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm(f => ({ ...f, img: reader.result }))
    reader.readAsDataURL(file)
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <div className="grid2">
        <label>
          <span>Name</span>
          <input className="input" value={form.name} onChange={(e)=>setForm(f=>({...f,name:e.target.value}))} required />
        </label>
        <label>
          <span>Price</span>
          <input className="input" type="number" step="0.01" min="0" value={form.price} onChange={(e)=>setForm(f=>({...f,price:e.target.value}))} required />
        </label>
      </div>
      {typeOptions && (
        <div>
          <span>Type</span>
          <div className="row" style={{marginTop:6}}>
            <select className="input" value={form.type} onChange={(e)=>setForm(f=>({...f,type:e.target.value}))}>
              <option value="">Select type</option>
              {typeOptions.map((t)=> (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setNewTypeName('')
                setShowTypeModal(true)
              }}
            >Add Type</button>
          </div>
        </div>
      )}

      {showTypeModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="card-title">Add New Type</div>
            <input
              autoFocus
              className="input"
              placeholder="e.g., Salad"
              value={newTypeName}
              onChange={(e)=>setNewTypeName(e.target.value)}
              onKeyDown={(e)=>{
                if (e.key === 'Enter') {
                  const t = (newTypeName||'').trim()
                  if (!t) return
                  onAddType?.(t)
                  setForm(f => ({ ...f, type: t }))
                  setShowTypeModal(false)
                  setNewTypeName('')
                } else if (e.key === 'Escape') {
                  setShowTypeModal(false)
                }
              }}
            />
            <div className="actions" style={{justifyContent:'flex-end', marginTop:10}}>
              <button className="btn" type="button" onClick={()=>setShowTypeModal(false)}>Cancel</button>
              <button
                className="btn primary"
                type="button"
                onClick={()=>{
                  const t = (newTypeName||'').trim()
                  if (!t) return
                  onAddType?.(t)
                  setForm(f => ({ ...f, type: t }))
                  setShowTypeModal(false)
                  setNewTypeName('')
                }}
              >Save</button>
            </div>
          </div>
        </div>
      )}
      {includeImage && (
        <>
          <label>
            <span>Image URL (optional)</span>
            <input className="input" placeholder="https://..." value={form.img} onChange={(e)=>setForm(f=>({...f,img:e.target.value}))} />
          </label>
          <div className="row" style={{gap:8, alignItems:'center'}}>
            <label className="btn">
              Upload Image
              <input type="file" accept="image/*" style={{display:'none'}} onChange={(e)=>handleImageFile(e.target.files?.[0])} />
            </label>
            {form.img && <span className="muted">Preview below</span>}
          </div>
          {form.img && (
            <div style={{marginTop:8}}>
              <img src={form.img} alt="preview" style={{height:80, borderRadius:8}} onError={(e)=>{e.currentTarget.style.display='none'}} />
            </div>
          )}
        </>
      )}
      <div className="actions">
        <button className="btn primary" type="submit">{initial ? 'Update' : 'Add'} Item</button>
        {onCancel && <button className="btn" type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
