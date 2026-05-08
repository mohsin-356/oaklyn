import { useEffect, useMemo, useRef, useState } from 'react'
import { useDialog } from '../components/ConfirmProvider.jsx'
import { getAllCatalog, listSales, listReturns, getActiveBusinessDateId, getBusinessDateId, getRestaurantInfo } from '../utils/storage.js'
import { listAllRecipes, getRecipe, setRecipe, deleteRecipe, exportRecipes, importRecipes } from '../utils/recipes.js'

export default function Recipes(){
  const [items, setItems] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [ingredients, setIngredients] = useState([])
  const [allRecipes, setAllRecipes] = useState({})
  const [sales, setSales] = useState([])
  const [returns, setReturns] = useState([])
  const [editing, setEditing] = useState(false)
  const [dialogItemId, setDialogItemId] = useState('')
  const [dateOnly, setDateOnly] = useState('') // yyyy-mm-dd filter for usage
  const [importError, setImportError] = useState('')
  const dialog = useDialog()
  const dateRef = useRef(null)

  // Load catalog items
  useEffect(()=>{
    getAllCatalog().then(({ foods, deals, drinks, extras }) => {
      const flat = [
        ...foods.map(i=>({ ...i, section:'Food' })),
        ...deals.map(i=>({ ...i, section:'Deal' })),
        ...drinks.map(i=>({ ...i, section:'Drink' })),
        ...extras.map(i=>({ ...i, section:'Extra' })),
      ]
      setItems(flat)
    }).catch(()=>{})
  },[])

  // Load recipes, and live-reload sales/returns; keep date synced to active business date
  useEffect(()=>{ listAllRecipes().then(r => setAllRecipes(r)).catch(()=>{}) },[])
  useEffect(()=>{ 
    const load = async () => { try { setSales(await listSales()) } catch {}; try { setReturns(await listReturns()) } catch {} }
    load()
    // Default selected date to the active business date
    setDateOnly(getActiveBusinessDateId())
    const syncBizDate = () => { setDateOnly(getActiveBusinessDateId()) }
    const onSales = () => load()
    const onReturns = () => load()
    window.addEventListener('data:sales-changed', onSales)
    window.addEventListener('data:returns-changed', onReturns)
    window.addEventListener('day:status-changed', syncBizDate)
    window.addEventListener('storage', load)
    window.addEventListener('storage', syncBizDate)
    return () => {
      window.removeEventListener('data:sales-changed', onSales)
      window.removeEventListener('data:returns-changed', onReturns)
      window.removeEventListener('day:status-changed', syncBizDate)
      window.removeEventListener('storage', load)
      window.removeEventListener('storage', syncBizDate)
    }
  },[])

  // Load selected recipe
  useEffect(()=>{ 
    if (selectedId) {
      getRecipe(selectedId).then(rec => {
        setIngredients(rec)
        setEditing((rec||[]).length === 0)
      }).catch(()=>{})
    } else {
      setIngredients([])
      setEditing(false)
    }
  },[selectedId])

  // Form handlers
  const onAddRow = () => setIngredients(curr => [...curr, { name:'', unit:'', qty:'' }])
  const onChangeRow = (idx, field, value) => setIngredients(curr => curr.map((r,i)=> i===idx ? { ...r, [field]: value } : r))
  const onDeleteRow = (idx) => setIngredients(curr => curr.filter((_,i)=>i!==idx))

  const onSave = async () => {
    if (!selectedId) return
    const cleaned = ingredients
      .filter(ing => (ing.name||'').trim() && (ing.qty!=='' && !isNaN(parseFloat(ing.qty))))
      .map(ing => ({ name: ing.name.trim(), unit: (ing.unit||'').trim(), qty: parseFloat(ing.qty)||0 }))
    await setRecipe(selectedId, cleaned)
    setIngredients(cleaned)
    setAllRecipes(await listAllRecipes())
    setEditing(false)
    // Automatically close the form by clearing the selected item
    setSelectedId('')
  }

  const onCancelEdit = async () => {
    if (!selectedId) return
    setIngredients(await getRecipe(selectedId))
    setEditing(false)
  }

  const onClearRecipe = async () => {
    if (!selectedId) return
    const ok = await dialog.confirm({ title: 'Clear Recipe', description: "Clear this item's recipe?" })
    if (!ok) return
    await deleteRecipe(selectedId)
    setIngredients([])
    setAllRecipes(await listAllRecipes())
  }

  // Compute net sold quantities per item
  const soldByItem = useMemo(()=>{
    const acc = {}
    sales.forEach(s => { (s.items||[]).forEach(it => { acc[it.id] = (acc[it.id]||0) + (parseFloat(it.qty)||0) }) })
    returns.forEach(r => { (r.items||[]).forEach(it => { acc[it.id] = (acc[it.id]||0) - (parseFloat(it.qty)||0) }) })
    return acc
  },[sales, returns])

  // Selected item (quantities computed after daySoldByItem is defined)
  const selectedItem = items.find(i => String(i.id)===String(selectedId))

  // Per-date sales (net) by item for calendar date filter
  const daySoldByItem = useMemo(() => {
    if (!dateOnly) return {}
    try {
      const daySales = sales.filter(s => (s?.bizId || getBusinessDateId(s.createdAt||0)) === dateOnly)
      const dayReturns = returns.filter(r => (r?.bizId || getBusinessDateId(r.createdAt||0)) === dateOnly)
      const acc = {}
      daySales.forEach(s => { (s.items||[]).forEach(it => { acc[it.id] = (acc[it.id]||0) + (parseFloat(it.qty)||0) }) })
      dayReturns.forEach(r => { (r.items||[]).forEach(it => { acc[it.id] = (acc[it.id]||0) - (parseFloat(it.qty)||0) }) })
      return acc
    } catch {
      return {}
    }
  }, [dateOnly, sales, returns])

  // Use per-date sold quantity when a date is selected; fallback to all-time when no date filter
  const selectedSoldQty = (dateOnly ? (daySoldByItem[selectedId] || 0) : (soldByItem[selectedId] || 0))

  const selectedUsage = useMemo(()=>{
    if (!selectedId) return []
    return (allRecipes[selectedId]||[]).map(ing => ({
      name: ing.name||'',
      unit: ing.unit||'',
      perItemQty: parseFloat(ing.qty)||0,
      totalUsed: (parseFloat(ing.qty)||0) * selectedSoldQty,
    }))
  },[selectedId, selectedSoldQty, allRecipes])

  // Helper to normalize labels for consistent aggregation (trim, collapse spaces, lowercase)
  function normLabel(s){
    return String(s || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  }

  // Aggregate ingredients used for the selected calendar date
  const dayIngredientUsage = useMemo(() => {
    if (!dateOnly) return []
    const usage = {} // key -> { name, unit, total }
    for (const [itemId, soldQty] of Object.entries(daySoldByItem)) {
      if (!soldQty) continue
      const rec = (allRecipes[itemId] || [])
      rec.forEach((ing) => {
        const per = parseFloat(ing?.qty)||0
        const unitRaw = (ing?.unit||'')
        const nameRaw = (ing?.name||'')
        if (!nameRaw) return
        const key = `${normLabel(nameRaw)}@@${normLabel(unitRaw)}`
        if (!usage[key]) usage[key] = { name: nameRaw.trim(), unit: unitRaw.trim(), total: 0 }
        usage[key].total += per * (parseFloat(soldQty)||0)
      })
    }
    return Object.values(usage).map(row => ({
      name: row.name,
      unit: row.unit,
      total: row.total,
    })).sort((a,b) => {
      const diff = (b.total||0) - (a.total||0)
      return diff !== 0 ? diff : a.name.localeCompare(b.name)
    })
  }, [dateOnly, daySoldByItem, allRecipes])

  // (Summary card removed)

  // Download PDF for recipe usage for the selected date (Items table ONLY)
  async function downloadRecipesPdf(){
    const ymd = dateOnly || '—'
    const rest = getRestaurantInfo()

    try {
      await ensureJsPdfLoaded()
      const { jsPDF } = window.jspdf
      const doc = new jsPDF({ unit:'pt', format:'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 50
      const maxWidth = pageWidth - (2 * margin)
      let y = margin

      // Helper to check page break
      const checkPageBreak = (requiredSpace = 25) => {
        if (y + requiredSpace > pageHeight - margin) {
          doc.addPage()
          y = margin
          return true
        }
        return false
      }

      // Professional Header with colored background
      doc.setFillColor(231, 76, 60) // Red color for restaurant theme
      doc.rect(0, 0, pageWidth, 100, 'F')
      
      // Restaurant name in white
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(26)
      try { doc.setFont('helvetica', 'bold') } catch {}
      doc.text(rest.name || 'Restaurant', pageWidth / 2, 35, { align: 'center' })
      
      doc.setFontSize(12)
      try { doc.setFont('helvetica', 'normal') } catch {}
      if (rest.address) {
        doc.text(rest.address, pageWidth / 2, 55, { align: 'center' })
      }
      if (rest.phone) {
        doc.text(rest.phone, pageWidth / 2, 72, { align: 'center' })
      }
      
      // Report Title with background
      y = 120
      doc.setFillColor(52, 73, 94) // Dark blue-gray
      doc.roundedRect(margin, y, pageWidth - 2*margin, 60, 5, 5, 'F')
      
      y += 25
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(20)
      try { doc.setFont('helvetica', 'bold') } catch {}
      doc.text('Recipes Usage Report', pageWidth / 2, y, { align: 'center' })
      
      y += 22
      doc.setFontSize(13)
      try { doc.setFont('helvetica', 'normal') } catch {}
      doc.text(`Date: ${ymd}`, pageWidth / 2, y, { align: 'center' })
      
      y += 40
      doc.setTextColor(0, 0, 0)

      // Items Used Section
      const usedEntries = Object.entries(daySoldByItem || {}).filter(([,qty]) => (parseFloat(qty)||0) > 0)
      const usedCount = usedEntries.length

      try { doc.setFont('helvetica', 'bold') } catch {}
      doc.setFontSize(14)
      doc.setTextColor(40, 40, 40)
      doc.text(`Items Used (${usedCount})`, margin, y)
      y += 25

      if (usedCount > 0) {
        // Professional Table Header with gradient effect
        doc.setFillColor(41, 128, 185) // Blue header
        doc.roundedRect(margin, y - 18, maxWidth, 28, 3, 3, 'F')
        
        try { doc.setFont('helvetica', 'bold') } catch {}
        doc.setFontSize(12)
        doc.setTextColor(255, 255, 255)
        doc.text('Item Name', margin + 15, y)
        doc.text('Quantity Used', pageWidth - margin - 15, y, { align: 'right' })
        y += 18

        // Table Rows with better styling
        try { doc.setFont('helvetica', 'normal') } catch {}
        doc.setFontSize(11)
        doc.setTextColor(40, 40, 40)
        
        let isAlternate = false
        for (const [itemId, qty] of usedEntries.sort()) {
          checkPageBreak(25)
          
          const item = items.find(i => String(i.id)===String(itemId))
          const name = item?.name || itemId
          
          // Alternate row background with colors
          if (isAlternate) {
            doc.setFillColor(236, 240, 241) // Light blue-gray
          } else {
            doc.setFillColor(255, 255, 255) // White
          }
          doc.roundedRect(margin, y - 14, maxWidth, 22, 2, 2, 'F')
          isAlternate = !isAlternate
          
          // Draw subtle border
          doc.setDrawColor(189, 195, 199)
          doc.setLineWidth(0.5)
          doc.roundedRect(margin, y - 14, maxWidth, 22, 2, 2, 'S')
          
          doc.setTextColor(44, 62, 80)
          doc.text(String(name).substring(0, 45), margin + 15, y)
          
          // Highlight quantity in bold
          try { doc.setFont('helvetica', 'bold') } catch {}
          doc.setTextColor(22, 160, 133) // Green for quantity
          doc.text(Number(qty || 0).toFixed(2), pageWidth - margin - 15, y, { align: 'right' })
          try { doc.setFont('helvetica', 'normal') } catch {}
          
          y += 22
        }
      } else {
        // No data message with icon-like styling
        doc.setFillColor(255, 243, 205) // Light yellow
        doc.roundedRect(margin, y, maxWidth, 40, 5, 5, 'F')
        doc.setTextColor(133, 100, 4)
        try { doc.setFont('helvetica', 'italic') } catch {}
        doc.setFontSize(11)
        doc.text('No items used on this date', pageWidth / 2, y + 25, { align: 'center' })
      }

      // Professional Footer
      y = pageHeight - 35
      doc.setFillColor(52, 73, 94)
      doc.rect(0, y - 10, pageWidth, 50, 'F')
      
      try { doc.setFont('helvetica', 'normal') } catch {}
      doc.setFontSize(10)
      doc.setTextColor(255, 255, 255)
      doc.text('Generated by Oaklyn POS System', pageWidth / 2, y + 5, { align: 'center' })
      doc.setFontSize(9)
      doc.text(`${new Date().toLocaleString('en-PK')}`, pageWidth / 2, y + 20, { align: 'center' })

      const filename = `Recipes_Usage_${ymd}.pdf`
      doc.save(filename)
      return
    } catch (e) {
      // Fallback for older browsers or PDF generation failure
      const header = [
        'Recipes Usage Report',
        `Date: ${ymd}`,
        ''.padEnd(40,'-')
      ]

      const itemLines = []
      const usedEntries = Object.entries(daySoldByItem || {}).filter(([,qty]) => (parseFloat(qty)||0) > 0)
      const usedCount = usedEntries.length
      for (const [itemId, qty] of usedEntries.sort()) {
        const item = items.find(i => String(i.id)===String(itemId))
        const name = item?.name || itemId
        itemLines.push(`${name}: ${Number(qty||0).toFixed(2)}`)
      }

      const contentLines = [
        ...header,
        `Items Used (${usedCount})`,
        ...((usedCount>0)?itemLines:['  None']),
        ''.padEnd(40,'-')
      ]

      const printable = `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <title>Recipes Usage Report</title>
      <style>*{box-sizing:border-box} body{font-family: ui-monospace, Menlo, Consolas, monospace; padding:16px; white-space:pre-wrap}
      .controls{display:flex; gap:8px; justify-content:flex-end; margin-bottom:8px}
      .btn{padding:6px 10px; border:1px solid #333; background:#f5f5f5; cursor:pointer}
      @media print{ .controls{ display:none } }
      </style></head><body>
      <div class="controls"><button class="btn" onclick="window.close()">OK</button><button class="btn" onclick="window.print()">Print</button></div>
      ${contentLines.map(l=>l.replace(/&/g,'&amp;').replace(/</g,'&lt;')).join('\n')}
      </body></html>`
      const w = window.open('', '_blank', 'width=900,height=700')
      if (!w) return
      w.document.open(); w.document.write(printable); w.document.close()
    }
  }

  // Shared helpers (duplicated locally for simplicity)
  function ensureJsPdfLoaded(){
    return new Promise((resolve, reject)=>{
      if (window.jspdf && window.jspdf.jsPDF) return resolve()
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
      script.async = true
      script.onload = ()=> { if (window.jspdf && window.jspdf.jsPDF) resolve(); else reject(new Error('jsPDF not available')) }
      script.onerror = ()=> reject(new Error('Failed to load jsPDF'))
      document.head.appendChild(script)
    })
  }
  function wrapText(doc, text, maxWidth){
    if (!text) return ['']
    const words = String(text).split(/\s+/)
    const lines = []
    let cur = ''
    for (const w of words){
      const test = cur ? cur + ' ' + w : w
      const width = doc.getTextDimensions(test).w
      if (width <= maxWidth) cur = test
      else { if (cur) lines.push(cur); cur = w }
    }
    if (cur) lines.push(cur)
    return lines
  }

  // Download Ingredients table as Excel (.xlsx). Fallback to CSV if SheetJS is unavailable.
  async function downloadIngredientsExcel(){
    const ymd = dateOnly || '—'
    const rows = dayIngredientUsage.map(row => ({
      Ingredient: row.name,
      Unit: row.unit || '-',
      Total: Number(row.total||0)
    }))
    if (rows.length === 0) {
      try { alert('No ingredients to export for the selected date.') } catch {}
      return
    }

    try {
      await ensureSheetJsLoaded()
      const wb = window.XLSX.utils.book_new()
      const ws = window.XLSX.utils.json_to_sheet(rows)
      window.XLSX.utils.book_append_sheet(wb, ws, 'Ingredients')
      const filename = `Ingredients_Usage_${ymd}.xlsx`
      window.XLSX.writeFile(wb, filename)
      return
    } catch (e) {
      console.error('SheetJS export failed, falling back to CSV', e)
      // Fallback to CSV
      const header = ['Ingredient','Unit','Total']
      const csv = [header.join(',')].concat(rows.map(r => [
        String(r.Ingredient).replaceAll('"','""'),
        String(r.Unit).replaceAll('"','""'),
        String(r.Total)
      ].map(v=>`"${v}"`).join(','))).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Ingredients_Usage_${ymd}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      try { alert('Excel library not available. Downloaded CSV instead.') } catch {}
    }
  }

  function ensureSheetJsLoaded(){
    return new Promise((resolve, reject)=>{
      if (window.XLSX && window.XLSX.utils) return resolve()
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'
      script.async = true
      script.onload = ()=> { if (window.XLSX && window.XLSX.utils) resolve(); else reject(new Error('SheetJS not available')) }
      script.onerror = ()=> reject(new Error('Failed to load SheetJS'))
      document.head.appendChild(script)
    })
  }

  return (
    <section className="page">
      <div className="row header-row">
        <h1>Recipes</h1>
        <div className="row">
          <button
            className="btn"
            type="button"
            onClick={async () => {
              try {
                const json = await exportRecipes()
                const blob = new Blob([json], { type: 'application/json' })
                const a = document.createElement('a')
                const url = URL.createObjectURL(blob)
                const ts = new Date()
                const name = `recipes-${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}.json`
                a.href = url
                a.download = name
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
              } catch {}
            }}
          >Export</button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              setImportError('')
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = 'application/json,.json'
              input.onchange = async (e) => {
                const file = e.target.files && e.target.files[0]
                if (!file) return
                try {
                  const text = await file.text()
                  const ok = await importRecipes(text)
                  if (!ok) {
                    setImportError('Invalid recipes file.')
                    return
                  }
                  setAllRecipes(await listAllRecipes())
                  // Reset editing state and selection to avoid stale data
                  setSelectedId('')
                  setIngredients([])
                } catch (err) {
                  setImportError('Failed to read selected file.')
                }
              }
              input.click()
            }}
          >Import</button>
        </div>
      </div>
      {importError && (
        <div className="card" style={{marginTop:8}}>
        </div>
      )}

      {/* Date filter for usage */}
      <div className="card" style={{marginBottom:12}}>
        <div className="row" style={{justifyContent:'space-between', flexWrap:'wrap', gap:8}}>
          <div className="row" style={{gap:8}}>
            <label>
              <span className="muted" style={{display:'block'}}>Date</span>
              <div className="input-wrap" style={{minWidth:220}}>
                <input ref={dateRef} className="input" type="date" value={dateOnly} onChange={e=>setDateOnly(e.target.value)} />
                <button
                  type="button"
                  className="input-icon-btn calendar-toggle"
                  aria-label="Open date picker"
                  title="Open date picker"
                  onClick={()=>{ const el = dateRef.current; if (el && typeof el.showPicker === 'function') el.showPicker(); else el?.focus() }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </button>
              </div>
            </label>
          </div>
          <div className="row" style={{gap:8, alignItems:'center'}}>
            <div className="muted">Showing usage for {dateOnly || '—'}</div>
            <button className="btn" onClick={downloadRecipesPdf} disabled={!dateOnly} title="Download PDF (Items table only)">Download PDF</button>
            <button className="btn" onClick={downloadIngredientsExcel} disabled={!dateOnly} title="Download Ingredients as Excel">Ingredients (Excel)</button>
          </div>
        </div>
      </div>
      <div className="card">
        <div className="card-title">Add / Edit Item Recipe</div>
        <div className="grid2">
          <label>
            <span>Item</span>
            <select className="input" value={selectedId} onChange={(e)=>setSelectedId(e.target.value)}>
              <option value="">Select Item</option>
              {items.map(it => (
                <option key={String(it.id || it._id || Math.random())} value={String(it.id || it._id || '')}>{it.name} {it.section ? `(${it.section})` : ''}</option>
              ))}
            </select>
          </label>
        </div>

        {selectedId && (
          <div style={{marginTop:12}}>
            <div className="muted" style={{marginBottom:8}}>
              {selectedItem?.name || 'Item'} sold: <b>{selectedSoldQty}</b>
            </div>
            <div className="bill-head" style={{gridTemplateColumns:'1fr 120px 120px 120px 100px'}}>
              <div>Ingredient</div>
              <div>Unit</div>
              <div>Per Item Qty</div>
              <div>Total Used</div>
              <div>Actions</div>
            </div>
            {ingredients.length===0 && <div className="muted">No ingredients yet.</div>}

            {/* Read-only view */}
            {!editing && ingredients.map((row, idx) => (
              <div key={idx} className="bill-row" style={{gridTemplateColumns:'1fr 120px 120px 120px 100px'}}>
                <div className="grow">{row.name}</div>
                <div>{row.unit||'-'}</div>
                <div>{Number(row.qty||0).toFixed(2)}</div>
                <div>{Number((parseFloat(row.qty)||0) * selectedSoldQty).toFixed(2)}</div>
                <div></div>
              </div>
            ))}

            {/* Edit form */}
            {editing && ingredients.map((row, idx) => (
              <div key={idx} className="bill-row" style={{gridTemplateColumns:'1fr 120px 120px 120px 100px'}}>
                <input className="input" placeholder="e.g., Bun" value={row.name} onChange={(e)=>onChangeRow(idx,'name',e.target.value)} />
                <input className="input" placeholder="e.g., pcs / g / kg" value={row.unit||''} onChange={(e)=>onChangeRow(idx,'unit',e.target.value)} />
                <input className="input" type="number" step="0.01" min="0" value={row.qty} onChange={(e)=>onChangeRow(idx,'qty',e.target.value)} />
                <div>{Number((parseFloat(row.qty)||0) * selectedSoldQty).toFixed(2)}</div>
                <button className="btn danger" onClick={()=>onDeleteRow(idx)}>Remove</button>
              </div>
            ))}

            <div className="actions">
              {!editing && (
                <>
                  <button className="btn" onClick={()=>setEditing(true)}>Edit Recipe</button>
                  <button className="btn" onClick={onClearRecipe}>Clear</button>
                </>
              )}
              {editing && (
                <>
                  <button className="btn" onClick={onAddRow}>Add Ingredient</button>
                  <button className="btn primary" onClick={onSave}>Save Recipe</button>
                  <button className="btn" onClick={onCancelEdit}>Cancel</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      

      {/* Items grid: each item as a card; clicking opens details dialog */}
      <div className="card recipes-items" style={{marginTop:16}}>
        <div className="card-title">Items Used on {dateOnly || '—'}</div>
        <div className="grid">
          {items.length===0 && <div className="muted">No items yet.</div>}
          {(() => {
            // If no date selected, show all items
            if (!dateOnly) {
              return items.map((it) => (
                <div key={String(it.id || it._id || Math.random())} className="card recipe-item" style={{cursor:'pointer', minHeight:80, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={()=>setDialogItemId(String(it.id || it._id || ''))} title={it.name}>
                  <div style={{fontWeight:600}}>{it.name}</div>
                </div>
              ))
            }
            // Compute usage for selected business date using persisted bizId when available
            const daySales = sales.filter(s => (s?.bizId || getBusinessDateId(s.createdAt||0)) === dateOnly)
            const dayReturns = returns.filter(r => (r?.bizId || getBusinessDateId(r.createdAt||0)) === dateOnly)
            const used = {}
            daySales.forEach(s => { (s.items||[]).forEach(it => { used[it.id] = (used[it.id]||0) + (parseFloat(it.qty)||0) }) })
            dayReturns.forEach(r => { (r.items||[]).forEach(it => { used[it.id] = (used[it.id]||0) - (parseFloat(it.qty)||0) }) })
            const usedItems = items.filter(it => (used[it.id]||0) > 0)
            if (usedItems.length === 0) return <div className="muted">No items used on this date.</div>
            return usedItems.map((it) => (
              <div key={String(it.id || it._id || Math.random())} className="card recipe-item" style={{cursor:'pointer', minHeight:80, display:'flex', alignItems:'center', justifyContent:'center'}} onClick={()=>setDialogItemId(String(it.id || it._id || ''))} title={it.name}>
                <div style={{fontWeight:600}}>{it.name}</div>
              </div>
            ))
          })()}
        </div>
      </div>

      {/* Bottom table: aggregated ingredients usage for selected date */}
      <div className="card" style={{marginTop:16}}>
        <div className="card-title">Ingredients Used on {dateOnly || '—'} ({dayIngredientUsage.length})</div>
        <div className="bill-head" style={{gridTemplateColumns:'1fr 160px 160px'}}>
          <div>Ingredient</div>
          <div>Unit</div>
          <div>Total Used</div>
        </div>
        {(!dateOnly || dayIngredientUsage.length===0) && (
          <div className="muted">{dateOnly ? 'No ingredients used on this date.' : 'Select a date to view usage.'}</div>
        )}
        {dayIngredientUsage.map((row, idx) => (
          <div key={idx} className="bill-row" style={{gridTemplateColumns:'1fr 160px 160px'}}>
            <div className="grow">{row.name}</div>
            <div>{row.unit || '-'}</div>
            <div>{Number(row.total||0).toFixed(2)}</div>
          </div>
        ))}
      </div>

      {/* Dialog for item details usage */}
      {dialogItemId && (
        <div
          role="dialog"
          aria-modal="true"
          className="modal-overlay"
          onClick={()=>setDialogItemId('')}
        >
          <div className="modal" style={{maxWidth:'640px'}} onClick={(e)=>e.stopPropagation()}>
            {(() => {
              const item = items.find(i => String(i.id)===String(dialogItemId))
              const factor = (dateOnly ? (daySoldByItem[dialogItemId] || 0) : (soldByItem[dialogItemId] || 0))
              const rec = allRecipes[dialogItemId] || []
              return (
                <>
                  <div className="card-title">{item?.name || 'Item'} Usage Details</div>
                  <div className="muted" style={{marginBottom:8}}>Sold: <b>{Number(factor)}</b></div>
                  <div className="bill-head" style={{gridTemplateColumns:'1fr 140px 140px 140px'}}>
                    <div>Ingredient</div>
                    <div>Unit</div>
                    <div>Per Item Qty</div>
                    <div>Total Used</div>
                  </div>
                  {(!rec || rec.length===0) && <div className="muted">No recipe added yet for this item.</div>}
                  {(rec||[]).map((ing, idx) => (
                    <div key={idx} className="bill-row" style={{gridTemplateColumns:'1fr 140px 140px 140px'}}>
                      <div className="grow">{ing.name}</div>
                      <div>{ing.unit||'-'}</div>
                      <div>{Number(ing.qty||0).toFixed(2)}</div>
                      <div>{Number((parseFloat(ing.qty)||0) * (parseFloat(factor)||0)).toFixed(2)}</div>
                    </div>
                  ))}
                  <div className="actions" style={{justifyContent:'flex-end'}}>
                    <button className="btn" onClick={()=>setDialogItemId('')}>Close</button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </section>
  )
}
