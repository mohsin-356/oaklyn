import { useEffect, useMemo, useState } from 'react'
import { StorageKeys, getAllCatalog, listBill, setBill } from '../utils/storage.js'

function BillRow({ row, onChangeQty, onRemove }) {
  return (
    <div className="bill-row">
      <div className="grow">{row.name} <span className="muted">({row.category})</span></div>
      <div className="price">${row.price.toFixed(2)}</div>
      <input className="input qty" type="number" min="1" value={row.qty} onChange={(e)=>onChangeQty(row.id, parseInt(e.target.value||'1',10))} />
      <div className="price">${(row.price * row.qty).toFixed(2)}</div>
      <button className="btn danger" onClick={() => onRemove(row.id)}>Remove</button>
    </div>
  )
}

export default function CutBill() {
  const [catalog, setCatalog] = useState({ foods: [], deals: [], drinks: [], extras: [] })
  const [bill, setBillState] = useState([])

  useEffect(() => {
    getAllCatalog().then(c => setCatalog(c)).catch(()=>{})
    listBill().then(b => setBillState(b)).catch(()=>{})
  }, [])

  useEffect(() => { setBill(bill).catch(()=>{}) }, [bill])

  const total = useMemo(() => bill.reduce((s, r) => s + r.price * r.qty, 0), [bill])

  const addToBill = (category, id, qty=1) => {
    if (!id) return
    const sid = String(id || '')
    const source = catalog[category].find(i => String(i.id || i._id || '') === sid)
    if (!source) return
    setBillState(prev => {
      const existing = prev.find(r => String(r.id || '') === sid)
      if (existing) return prev.map(r => String(r.id || '') === sid ? { ...r, qty: r.qty + qty } : r)
      return [...prev, { id: sid, name: source.name, price: source.price, category, qty }]
    })
  }

  const changeQty = (id, qty) => {
    if (isNaN(qty) || qty < 1) qty = 1
    const sid = String(id || '')
    setBillState(prev => prev.map(r => String(r.id || '') === sid ? { ...r, qty } : r))
  }

  const removeRow = (id) => {
    const sid = String(id || '')
    setBillState(prev => prev.filter(r => String(r.id || '') !== sid))
  }
  const clearBill = () => setBillState([])

  return (
    <section>
      <h1>Cut Bill</h1>

      <div className="card">
        <div className="grid4">
          <CategoryPicker label="Food" items={catalog.foods} onAdd={(id, qty)=>addToBill('foods', id, qty)} />
          <CategoryPicker label="Deals" items={catalog.deals} onAdd={(id, qty)=>addToBill('deals', id, qty)} />
          <CategoryPicker label="Drinks" items={catalog.drinks} onAdd={(id, qty)=>addToBill('drinks', id, qty)} />
          <CategoryPicker label="Extras" items={catalog.extras} onAdd={(id, qty)=>addToBill('extras', id, qty)} />
        </div>
      </div>

      <div className="card">
        <div className="bill-head">
          <div className="grow">Item</div>
          <div className="price">Price</div>
          <div>Qty</div>
          <div className="price">Subtotal</div>
          <div></div>
        </div>
        {bill.length === 0 && <div className="muted">No items in bill.</div>}
        {bill.map(row => (
          <BillRow key={String(row.id || Math.random())} row={row} onChangeQty={changeQty} onRemove={removeRow} />
        ))}

        <div className="bill-foot">
          <button className="btn danger" onClick={clearBill}>Clear Bill</button>
          <div className="total">Total: ${total.toFixed(2)}</div>
        </div>
      </div>
    </section>
  )
}

function CategoryPicker({ label, items, onAdd }) {
  const [selected, setSelected] = useState('')
  const [qty, setQty] = useState(1)

  useEffect(() => { setSelected(items[0]?.id || '') }, [items])

  return (
    <div>
      <label className="muted">{label}</label>
      <div className="row">
        <select className="input" value={selected} onChange={(e)=>setSelected(e.target.value)}>
          {items.length === 0 && <option value="">No items</option>}
          {items.map(i => <option key={String(i.id || i._id || Math.random())} value={String(i.id || i._id || '')}>{i.name} (${i.price.toFixed(2)})</option>)}
        </select>
        <input className="input qty" type="number" min="1" value={qty} onChange={(e)=>setQty(parseInt(e.target.value||'1',10))} />
        <button className="btn" onClick={()=>onAdd(selected, qty)} disabled={!selected}>Add</button>
      </div>
    </div>
  )
}
