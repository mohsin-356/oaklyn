import { useConfirm } from './ConfirmProvider.jsx'

export default function ItemCard({ item, onEdit, onDelete, readOnly = false, onClick, hideEdit = false, variant = 'default', showAddButton = false, onAdd }) {
  const confirm = useConfirm?.()
  const handleDelete = async () => {
    if (!onDelete) return
    let ok = true
    if (confirm) {
      ok = await confirm({
        title: 'Delete Item',
        description: 'Are you sure you want to delete this?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
      })
    }
    if (ok) onDelete(item.id)
  }
  const isPos = variant === 'pos'
  if (isPos) {
    return (
      <div className={`card item-card-pos ${onClick ? 'clickable' : ''}`} onClick={onClick}>
        <div className="thumb-wrap">
          {item.img ? (
            <img className="thumb" src={item.img} alt={item.name} onError={(e)=>{e.currentTarget.style.display='none'}} />
          ) : (
            <div className="thumb" style={{display:'flex',alignItems:'center',justifyContent:'center',color:'#999'}}>No Image</div>
          )}
        </div>
        <div className="item-footer">
          <div className="item-meta">
            <div className="item-name">{item.name}</div>
            <div className="item-type">{item.type || '—'}</div>
          </div>
          <div className="item-actions">
            <div className="price">Rs.{item.price.toFixed(2)}</div>
            {showAddButton && (
              <button className="add-btn" title="Add" onClick={(e)=>{ e.stopPropagation(); onAdd?.(item) }}>+</button>
            )}
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className={`card ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      {item.img && (
        <div className="thumb-wrap">
          <img className="thumb" src={item.img} alt={item.name} onError={(e)=>{e.currentTarget.style.display='none'}} />
        </div>
      )}
      <div className="card-title">{item.name}</div>
      <div className="muted">{item.type || '—'}</div>
      <div className="price">Rs.{item.price.toFixed(2)}</div>
      {!readOnly && (
        <div className="actions" onClick={(e)=>e.stopPropagation()}>
          {!hideEdit && <button className="btn" onClick={() => onEdit?.(item)}>Edit</button>}
          <button className="btn danger" onClick={handleDelete}>Delete</button>
        </div>
      )}
    </div>
  )
}
