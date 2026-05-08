import { useEffect, useState } from 'react'
import ItemCard from '../components/ItemCard.jsx'
import { getAllCatalog } from '../utils/storage.js'

export default function Menu() {
  const [catalog, setCatalog] = useState({ foods: [], deals: [], drinks: [], extras: [] })

  useEffect(() => {
    getAllCatalog().then(c => setCatalog(c)).catch(()=>{})
  }, [])

  return (
    <section>
      <h1>Menu</h1>

      <CategorySection title="Food" items={catalog.foods} />
      <CategorySection title="Deals" items={catalog.deals} />
      <CategorySection title="Drinks" items={catalog.drinks} />
      <CategorySection title="Extras" items={catalog.extras} />
    </section>
  )
}

function CategorySection({ title, items }) {
  return (
    <div style={{marginTop: 12}}>
      <div className="card-title" style={{fontSize: 18}}>{title}</div>
      <div className="grid">
        {items.length === 0 && <div className="muted">No items.</div>}
        {items.map(i => (
          <ItemCard key={String(i.id || i._id || Math.random())} item={i} readOnly />
        ))}
      </div>
    </div>
  )
}
