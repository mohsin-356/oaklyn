import { useEffect, useMemo, useState } from 'react'
import SearchBar from '../components/SearchBar.jsx'
import ItemForm from '../components/ItemForm.jsx'
import ItemCard from '../components/ItemCard.jsx'
import { addItem, deleteItem, listItems, searchItems, updateItem } from '../utils/storage.js'

export default function CrudPage({ storageKey, title, typeOptions, showForm = false, includeImage = false, onAddType }) {
  const [items, setItems] = useState([])
  const [editing, setEditing] = useState(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    listItems(storageKey).then(r => setItems(r)).catch(()=>{})
  }, [storageKey])

  const [filtered, setFiltered] = useState([])
  useEffect(() => {
    if (!query) { setFiltered(items); return }
    searchItems(storageKey, query).then(r => setFiltered(r)).catch(() => setFiltered(items))
  }, [items, query, storageKey])

  const handleAdd = async (data) => {
    const created = await addItem(storageKey, data)
    if (created && created.error) { alert('Failed to add: ' + created.error); return }
    listItems(storageKey).then(r => setItems(r)).catch(()=>{})
  }

  const handleUpdate = async (data) => {
    const result = await updateItem(storageKey, data)
    if (result && result.error) { alert('Failed to update: ' + result.error); return }
    listItems(storageKey).then(r => setItems(r)).catch(()=>{})
    setEditing(null)
  }

  const handleDelete = async (id) => {
    const sid = String(id || '')
    const result = await deleteItem(storageKey, sid)
    if (result && result.error) { alert('Failed to delete: ' + result.error); return }
    listItems(storageKey).then(r => setItems(r)).catch(()=>{})
  }

  return (
    <section>
      <div className="row header-row">
        <h1>{title}</h1>
        <SearchBar onChange={setQuery} placeholder={`Search ${title.toLowerCase()}...`} />
      </div>

      {(showForm || editing) && (
        <ItemForm
          initial={editing}
          onSubmit={editing ? handleUpdate : handleAdd}
          onCancel={() => setEditing(null)}
          typeOptions={typeOptions}
          includeImage={includeImage}
          onAddType={onAddType}
        />
      )}

      <div className="grid">
        {filtered.map((item) => (
          <ItemCard key={String(item.id || item._id || Math.random())} item={item} onEdit={setEditing} onDelete={handleDelete} />
        ))}
        {filtered.length === 0 && <div className="muted">No items yet.</div>}
      </div>
    </section>
  )
}
