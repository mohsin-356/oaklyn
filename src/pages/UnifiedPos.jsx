import { useEffect, useMemo, useState } from 'react'
import { listItems, setBill, nextToken, getRestaurantInfo, addSale, isTokenClosed, getActiveBusinessDateId, getPrinterConfig, setLastToken, getCurrentUser, listUsers, createNotification, listTables, getActiveStaff } from '../utils/storage.js'
import * as db from '../services/db.js'
import { useDialog } from '../components/ConfirmProvider.jsx'
import AdminAuthModal from '../components/AdminAuthModal.jsx'

const StorageKeys = {
  foods: 'foods',
  deals: 'deals',
  drinks: 'drinks',
  extras: 'extras',
}

export default function UnifiedPos() {
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

  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all') // 'all', 'foods', 'deals', 'drinks', 'extras'
  const [cart, setCart] = useState([]) // {id, name, price, qty, category}
  const [customerName, setCustomerName] = useState('')
  const [tokenNumber, setTokenNumber] = useState('')
  const [orderType, setOrderType] = useState('') // '', 'dine-in', 'take-away', 'delivery'
  const [deliveryCharges, setDeliveryCharges] = useState(0)
  const [deliveryOptions, setDeliveryOptions] = useState(() => {
    try {
      const saved = localStorage.getItem('deliveryChargesOptions')
      return saved ? JSON.parse(saved) : [50, 70, 100, 150, 200]
    } catch {
      return [50, 70, 100, 150, 200]
    }
  })
  const [customDeliveryInput, setCustomDeliveryInput] = useState('')
  const [discountMode, setDiscountMode] = useState('percent') // 'percent' or 'fixed'
  const [discountValue, setDiscountValue] = useState('')
  const [paidAmount, setPaidAmount] = useState(0)
  const [finalized, setFinalized] = useState(false)
  const [showReceiptPreview, setShowReceiptPreview] = useState(false)
  const [receiptHtml, setReceiptHtml] = useState('')
  const [staffUsers, setStaffUsers] = useState([])
  const [selectedWaiterId, setSelectedWaiterId] = useState('')
  const [loyaltyModal, setLoyaltyModal] = useState(null) // null | { token, orderId }
  const [pendingLoyaltyModal, setPendingLoyaltyModal] = useState(null) // null | { token, orderId }
  const [loyaltyRequestSent, setLoyaltyRequestSent] = useState(false)
  const [tables, setTables] = useState([])
  const [selectedTableId, setSelectedTableId] = useState('')

  // States for three print types and reprint auth
  const [kotHtml, setKotHtml] = useState('')
  const [paidTicketHtml, setPaidTicketHtml] = useState('')
  const [activePreviewType, setActivePreviewType] = useState('bill') // 'bill'|'kot'|'paid'
  const [reprintAuth, setReprintAuth] = useState(null) // null | { type: 'bill'|'kot'|'paid', saleData: object }
  const [currentSaleData, setCurrentSaleData] = useState(null) // Store sale data for reprints
  const [isSavingOrder, setIsSavingOrder] = useState(false)
  const dialog = useDialog()
  const [tokensClosed, setTokensClosed] = useState(false)

  // Load all items from all categories
  const [allItems, setAllItems] = useState([])

  useEffect(() => {
    const loadAllItems = async () => {
      const foods = (await listItems(StorageKeys.foods)).map(item => ({ ...item, category: 'foods', categoryLabel: 'Food' }))
      const deals = (await listItems(StorageKeys.deals)).map(item => ({ ...item, category: 'deals', categoryLabel: 'Deals' }))
      const drinks = (await listItems(StorageKeys.drinks)).map(item => ({ ...item, category: 'drinks', categoryLabel: 'Drinks' }))
      const extras = (await listItems(StorageKeys.extras)).map(item => ({ ...item, category: 'extras', categoryLabel: 'Extras' }))
      setAllItems([...foods, ...deals, ...drinks, ...extras])
    }
    loadAllItems().catch(()=>{})
  }, [])

  // Load tables for dine-in orders
  useEffect(() => {
    const loadTables = async () => {
      try {
        const raw = await listTables()
        const safe = (Array.isArray(raw) ? raw : []).map(t => ({
          ...t,
          id: toId(t.id || t._id) || String(t.number || t.tableNumber || ''),
          _id: toId(t._id || t.id) || String(t.number || t.tableNumber || ''),
        }))
        setTables(safe)
      } catch {}
    }
    loadTables()
    const onTablesChanged = () => loadTables()
    window.addEventListener('tables:changed', onTablesChanged)
    return () => window.removeEventListener('tables:changed', onTablesChanged)
  }, [])

  // Load staff for waiter dropdown
  useEffect(() => {
    const loadStaff = async () => {
      try {
        const staff = await getActiveStaff()
        const arr = (Array.isArray(staff) ? staff : []).map(s => ({
          ...s,
          id: toId(s.id || s._id) || '',
          _id: toId(s._id || s.id) || '',
        })).filter(s => s.id)
        console.log('[POS] Staff loaded:', arr.length, arr.map(s => s.id))
        setStaffUsers(arr)
      } catch (e) {
        console.warn('[POS] Staff load error:', e.message)
        setStaffUsers([])
      }
    }
    loadStaff()
    const onStaffChanged = () => loadStaff()
    window.addEventListener('data:staff-changed', onStaffChanged)
    return () => window.removeEventListener('data:staff-changed', onStaffChanged)
  }, [])

  // Initialize token display to show next token that will be generated
  useEffect(() => {
    // Don't show any token number initially - it will be set when order is finalized
    setTokenNumber('')
  }, [])

  useEffect(() => {
    // Update closed state on storage changes
    const update = () => { isTokenClosed().then(v => setTokensClosed(v)).catch(()=>{}) }
    update()
    window.addEventListener('storage', update)
    window.addEventListener('day:status-changed', update)
    return () => { window.removeEventListener('storage', update); window.removeEventListener('day:status-changed', update) }
  }, [])

  // Filter items by category and search query
  const filtered = useMemo(() => {
    let items = allItems
    
    // Filter by category
    if (activeCategory !== 'all') {
      items = items.filter(item => item.category === activeCategory)
    }
    
    // Filter by search query
    if (query) {
      const q = query.toLowerCase()
      items = items.filter(item => 
        item.name.toLowerCase().includes(q) || 
        (item.type || '').toLowerCase().includes(q) ||
        (item.categoryLabel || '').toLowerCase().includes(q)
      )
    }
    
    return items
  }, [allItems, activeCategory, query])

  const addToCart = (item) => {
    if (tokensClosed) { 
      try { alert('Day is closed. New orders cannot be booked.') } catch {} 
      return 
    }
    const itemId = String(item.id || item._id || '')
    setCart(prev => {
      const found = prev.find(r => String(r.id || '') === itemId)
      if (found) return prev.map(r => String(r.id || '') === itemId ? { ...r, qty: r.qty + 1 } : r)
      return [...prev, { 
        id: itemId,
        name: item.name,
        price: item.price,
        qty: 1,
        category: item.category,
        categoryLabel: item.categoryLabel 
      }]
    })
  }

  const changeQty = (id, qty) => {
    if (isNaN(qty) || qty < 1) qty = 1
    const sid = String(id || '')
    setCart(prev => prev.map(r => String(r.id || '') === sid ? { ...r, qty } : r))
  }

  const removeRow = (id) => {
    const sid = String(id || '')
    setCart(prev => prev.filter(r => String(r.id || '') !== sid))
  }

  const clearCart = (keepToken = true) => {
    setCart([])
    setCustomerName('')
    setOrderType('')
    setDeliveryCharges(0)
    setDiscountMode('percent')
    setDiscountValue('')
    setPaidAmount(0)
    setFinalized(false)
    setSelectedTableId('')
    if (!keepToken) setTokenNumber('')
  }

  const total = useMemo(() => cart.reduce((s, r) => s + r.price * r.qty, 0), [cart])
  
  const deliveryAmt = useMemo(() => {
    const v = parseInt(deliveryCharges || 0, 10)
    return isNaN(v) || v < 0 ? 0 : v
  }, [deliveryCharges])

  const parsedDiscountValue = useMemo(() => {
    const n = parseFloat(discountValue)
    return isNaN(n) || n < 0 ? 0 : n
  }, [discountValue])

  const discountPercent = useMemo(() => {
    if (discountMode === 'percent') {
      return parsedDiscountValue
    }
    if (total <= 0) return 0
    return Number(((parsedDiscountValue / total) * 100).toFixed(2))
  }, [discountMode, parsedDiscountValue, total])

  const discountAmountRaw = useMemo(() => {
    if (discountMode === 'percent') {
      const pct = parsedDiscountValue
      if (isNaN(pct) || pct <= 0) return 0
      return Math.round((total * pct) / 100)
    }
    return Math.round(parsedDiscountValue)
  }, [discountMode, parsedDiscountValue, total])

  const discountExceeded = discountAmountRaw > total
  const discountAmount = discountExceeded ? 0 : discountAmountRaw
  const discountErrorMessage = discountExceeded ? 'Discount exceeds bill amount' : ''
  const discountDisplayPercent = discountMode === 'percent'
    ? parsedDiscountValue
    : total > 0
      ? Number(((parsedDiscountValue / total) * 100).toFixed(2))
      : 0

  const grandTotal = useMemo(() => {
    return Math.max(0, total + deliveryAmt - discountAmount)
  }, [total, deliveryAmt, discountAmount])

  const taxPercent = 0
  const taxAmount = useMemo(() => {
    return Math.round(((total + deliveryAmt - discountAmount) * taxPercent) / 100)
  }, [total, deliveryAmt, discountAmount])

  const printReceiptSilent = async (html) => {
    try {
      const content = String(html || receiptHtml || '')
      if (!content.trim()) return false
      const cfg = getPrinterConfig()
      if (!cfg || !cfg.enabled || !cfg.printerName) {
        try { alert('No printer configured. Please select a printer in Settings.') } catch {}
        return false
      }
      if (!(window.burgerPos && window.burgerPos.printSilentToPrinter)) {
        if (window.burgerPos && window.burgerPos.printWithDialog) {
          const res = await window.burgerPos.printWithDialog(content)
          return !!(res && res.success)
        }
        const w = window.open('', '_blank', 'width=400,height=600')
        if (!w) { try { alert('Pop-up blocked. Allow pop-ups and try again.') } catch {} ; return false }
        w.document.write(content); w.document.close()
        setTimeout(() => { try { w.focus(); w.print(); setTimeout(()=>w.close(), 1000) } catch {} }, 400)
        return true
      }
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(content)
      let result = await Promise.race([
        window.burgerPos.printSilentToPrinter(dataUrl, cfg.printerName),
        new Promise(resolve => setTimeout(() => resolve({ success:false, error:'Timeout' }), 6000))
      ])
      if (!(result && result.success)) {
        result = await Promise.race([
          window.burgerPos.printSilentToPrinter(content, cfg.printerName),
          new Promise(resolve => setTimeout(() => resolve({ success:false, error:'Timeout2' }), 6000))
        ])
      }
      if (!(result && result.success) && window.burgerPos.printSilentToPrinterDefault) {
        result = await Promise.race([
          window.burgerPos.printSilentToPrinterDefault(content),
          new Promise(resolve => setTimeout(() => resolve({ success:false, error:'TimeoutDefault' }), 7000))
        ])
      }
      if (!(result && result.success) && window.burgerPos.printWithDialog) {
        result = await window.burgerPos.printWithDialog(content)
      }
      if (result && result.success) return true
      try { alert(`Failed to print. ${result && result.error ? 'Error: ' + result.error : ''}`) } catch {}
      return false
    } catch (e) {
      try { alert(`Print error: ${e && e.message ? e.message : e}`) } catch {}
      return false
    }
  }
  
  function generateReceiptHtmlSilent({ token }) {
    try {
      const bizId = getActiveBusinessDateId()
      const rest = getRestaurantInfo()
      const currentUser = getCurrentUser()
      const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      const items = cart.map(r => ({ name: `${r.qty} x ${r.name}`, price: (r.price * r.qty).toFixed(2) }))
      const dt = new Date().toLocaleString('en-GB', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})
      const chg = Math.max(0, Number(paidAmount||0) - Number(grandTotal||0))
      const itemsHtml = items.map(l => `<div class="row"><div>${esc(l.name)}</div><div>Rs.${l.price}</div></div>`).join('')
      return `<!DOCTYPE html><html><head><meta charset="utf-8" />
        <title>Receipt</title>
        <style>@page{size:auto;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;height:auto !important;min-height:100% !important;overflow:visible !important}body{font-family:ui-monospace,Menlo,Consolas,monospace;padding:8px 8px 50mm 8px;font-weight:700;overflow:visible !important}img,svg{max-width:100%;height:auto}.center{text-align:center;font-weight:700;page-break-inside:avoid}.small{font-size:14px;line-height:1.35}.row{display:flex;justify-content:space-between;gap:8px;page-break-inside:avoid}.sep{border-top:1px dashed #000;margin:8px 0}.logo{display:block;margin:0 auto 6px;width:48mm;max-width:100%;height:auto}.tail{height:50mm}body::after{content:"";display:block;height:80mm}@media print{html,body{width:80mm;padding-bottom:50mm}}</style></head>
        <body>
          ${rest.logo ? `<img class="logo" src="${rest.logo}" alt="Logo" />` : ''}
          <div class="center" style="font-weight:900">${esc(rest.name || 'Restaurant')}</div>
          ${rest.address ? `<div class="center small" style="font-weight:900">${esc(rest.address)}</div>` : ''}
          ${rest.phone ? `<div class="center small" style="font-weight:900">${esc(rest.phone)}</div>` : ''}
          <div class="center small" style="font-weight:900">Business Date: ${esc(bizId)}</div>
          <div class="sep"></div>
          <div class="row"><div>Customer</div><div>${esc(customerName || 'Walk-in')}</div></div>
          <div class="row"><div>Token</div><div>${esc(token)}</div></div>
          <div class="row"><div>Order Type</div><div>${esc(orderType || 'Take-Away')}</div></div>
          <div class="row"><div>Date & Time</div><div>${esc(dt)}</div></div>
          ${currentUser ? `<div class="row"><div>Cashier</div><div>${esc(currentUser.name || currentUser.username)}</div></div>` : ''}
          ${selectedWaiter ? `<div class="row"><div>${waiterLabel}</div><div>${esc(selectedWaiter.name || selectedWaiter.username)} (${esc(selectedWaiter.role)})</div></div>` : ''}
          <div class="sep"></div>
          ${itemsHtml}
          <div class="sep"></div>
          <div class="row"><div>Subtotal</div><div>Rs.${Number(total||0).toFixed(2)}</div></div>
          ${deliveryAmt > 0 ? `<div class="row"><div><b>Delivery Charges</b></div><div>Rs.${Number(deliveryAmt||0).toFixed(2)}</div></div>` : ''}
          ${Number(discountAmount||0) > 0 ? `<div class="row"><div><b>Discount (${Number(discountDisplayPercent).toFixed(2).replace(/\.00$/, '')}%)</b></div><div>-Rs.${Number(discountAmount||0).toFixed(2)}</div></div>` : ''}
          <div class="row"><div>Tax</div><div>Rs.${Number(taxAmount||0).toFixed(2)}</div></div>
          <div class="row"><div><b>Total</b></div><div><b>Rs.${Number(grandTotal||0).toFixed(2)}</b></div></div>
          ${Number(paidAmount||0) > 0 ? `<div class="row"><div><b>Paid</b></div><div>Rs.${Number(paidAmount||0).toFixed(2)}</div></div>` : ''}
          ${chg > 0 ? `<div class="row"><div><b>Change</b></div><div>Rs.${chg.toFixed(2)}</div></div>` : ''}
          <div class="sep"></div>
          <div class="center small" style="font-weight:900">Thank you for your order!</div>
          ${(Number(token) > 0 && Number(token) % 100 === 0) ? `<div class="center small" style="font-weight:900;color:#d97706">*** LOYALTY CUSTOMER — 100th Bill Reward ***</div>` : ''}
          <div class="tail"></div>
        </body></html>`
    } catch (e) {
      return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial; width:68mm; margin:0 auto; padding:6mm 4mm">Receipt Error. Token ${token}</body></html>`
    }
  }

  // Generate KOT (Kitchen Order Ticket) HTML - for kitchen staff
  function generateKotHtml({ token, saleData }) {
    try {
      const rest = getRestaurantInfo()
      const currentUser = getCurrentUser()
      const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      const items = (saleData?.items || cart).map(r => ({ 
        name: r.name, 
        qty: r.quantity || r.qty,
        price: (r.price * (r.quantity || r.qty)).toFixed(0)
      }))
      const dt = new Date().toLocaleString('en-GB', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'})
      const orderTyp = saleData?.orderType || orderType || 'Take-Away'
      const waiterName = saleData?.waiterName || (selectedWaiter ? (selectedWaiter.name || selectedWaiter.username) : '')
      const selectedTable = tables.find(t => String(t._id || t.id) === String(selectedTableId || ''))
      const tableName = selectedTable ? (selectedTable.name || selectedTable.tableNumber || '') : ''
      
      const itemsHtml = items.map(i => `
        <div class="kot-item">
          <div class="kot-qty">${i.qty}</div>
          <div class="kot-name">${esc(i.name)}</div>
        </div>
      `).join('')
      
      return `<!DOCTYPE html><html><head><meta charset="utf-8" />
        <title>KOT - Kitchen Order</title>
        <style>@page{size:auto;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;height:auto !important;overflow:visible !important}body{font-family:ui-monospace,Menlo,Consolas,monospace;padding:8px;font-weight:700;width:80mm}.kot-header{text-align:center;border-bottom:2px dashed #000;padding-bottom:8px;margin-bottom:8px}.kot-title{font-size:18px;font-weight:900;margin-bottom:4px}.kot-subtitle{font-size:12px;font-weight:600}.kot-info{margin-bottom:10px;font-size:13px}.kot-info-row{display:flex;justify-content:space-between;margin:2px 0}.kot-items{margin-top:8px}.kot-item{display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px dashed #ccc}.kot-qty{min-width:30px;font-size:16px;font-weight:900}.kot-name{flex:1;font-size:14px;font-weight:700}.kot-footer{margin-top:15px;text-align:center;font-size:11px;border-top:1px dashed #000;padding-top:8px}</style></head>
        <body>
          <div class="kot-header">
            <div class="kot-title">KOT: Kitchen</div>
            <div class="kot-subtitle">${esc(rest.name || 'Restaurant')}</div>
          </div>
          <div class="kot-info">
            <div class="kot-info-row"><span>Order #:</span><span>${esc(token)}</span></div>
            <div class="kot-info-row"><span>Type:</span><span>${esc(orderTyp)}</span></div>
            ${tableName ? `<div class="kot-info-row"><span>Table:</span><span>${esc(tableName)}</span></div>` : ''}
            ${waiterName ? `<div class="kot-info-row"><span>Waiter:</span><span>${esc(waiterName)}</span></div>` : ''}
            <div class="kot-info-row"><span>Time:</span><span>${esc(dt)}</span></div>
          </div>
          <div class="kot-items">
            ${itemsHtml}
          </div>
          <div class="kot-footer">
            <div>Total Items: ${items.reduce((sum, i) => sum + Number(i.qty), 0)}</div>
            ${currentUser ? `<div>Cashier: ${esc(currentUser.name || currentUser.username)}</div>` : ''}
          </div>
        </body></html>`
    } catch (e) {
      return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial; width:68mm; margin:0 auto; padding:6mm 4mm">KOT Error. Token ${token}</body></html>`
    }
  }

  // Generate Paid Ticket HTML - for restaurant backup/internal record
  function generatePaidTicketHtml({ token, saleData }) {
    try {
      const bizId = getActiveBusinessDateId()
      const rest = getRestaurantInfo()
      const currentUser = getCurrentUser()
      const esc = (s) => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      const items = (saleData?.items || cart).map(r => ({ 
        name: r.name, 
        qty: r.quantity || r.qty,
        price: (r.price * (r.quantity || r.qty)).toFixed(2)
      }))
      const total = saleData?.total || grandTotal || 0
      const subtotal = saleData?.subtotal || total || 0
      const dt = new Date().toLocaleString('en-GB', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit'})
      const orderTyp = saleData?.orderType || orderType || 'Take-Away'
      const waiterName = saleData?.waiterName || (selectedWaiter ? (selectedWaiter.name || selectedWaiter.username) : '')
      const selectedTable = tables.find(t => String(t._id || t.id) === String(selectedTableId || ''))
      const tableName = selectedTable ? (selectedTable.name || selectedTable.tableNumber || '') : ''
      
      const itemsHtml = items.map(i => `
        <div class="row">
          <div>#${i.qty}: ${esc(i.name)}</div>
          <div>Rs.${i.price}</div>
        </div>
      `).join('')
      
      return `<!DOCTYPE html><html><head><meta charset="utf-8" />
        <title>Paid Ticket - Internal</title>
        <style>@page{size:auto;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;height:auto !important;overflow:visible !important}body{font-family:ui-monospace,Menlo,Consolas,monospace;padding:8px 8px 30mm 8px;font-weight:700;width:80mm}.center{text-align:center;font-weight:700}.small{font-size:13px;line-height:1.3}.row{display:flex;justify-content:space-between;gap:8px;padding:3px 0}.sep{border-top:2px dashed #000;margin:8px 0}.paid-stamp{font-size:24px;font-weight:900;text-align:center;border:3px solid #000;padding:8px;margin:10px 0;transform:rotate(-5deg)}</style></head>
        <body>
          <div class="center" style="font-size:20px;font-weight:900">${esc(rest.name || 'Restaurant')}</div>
          <div class="center small">${esc(rest.address || '')}</div>
          <div class="center small">Phone: ${esc(rest.phone || '')}</div>
          <div class="sep"></div>
          <div class="row"><span>Order #:</span><span>${esc(token)}</span></div>
          <div class="row"><span>Order Type:</span><span>${esc(orderTyp)}</span></div>
          ${tableName ? `<div class="row"><span>Table:</span><span>${esc(tableName)}</span></div>` : ''}
          ${waiterName ? `<div class="row"><span>Waiter:</span><span>${esc(waiterName)}</span></div>` : ''}
          <div class="row"><span>Date:</span><span>${esc(dt)}</span></div>
          ${currentUser ? `<div class="row"><span>Cashier:</span><span>${esc(currentUser.name || currentUser.username)}</span></div>` : ''}
          <div class="sep"></div>
          ${itemsHtml}
          <div class="sep"></div>
          <div class="row"><span>Sub Total</span><span>Rs.${Number(subtotal).toFixed(2)}</span></div>
          <div class="row"><span><b>Total</b></span><span><b>Rs.${Number(total).toFixed(2)}</b></span></div>
          <div class="paid-stamp">**Paid Ticket**</div>
          <div class="center small" style="margin-top:15px">Business Date: ${esc(bizId)}</div>
          <div class="center small">Internal Copy - Keep for Records</div>
        </body></html>`
    } catch (e) {
      return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial; width:68mm; margin:0 auto; padding:6mm 4mm">Paid Ticket Error. Token ${token}</body></html>`
    }
  }

  const currentUser = getCurrentUser()
  const cashierName = currentUser ? (currentUser.name || currentUser.username) : ''
  const selectedWaiter = staffUsers.find(u => String(u.id || u._id || '') === String(selectedWaiterId || ''))
  const waiterLabel = orderType === 'delivery' ? 'Delivery By' : orderType === 'take-away' ? 'Handled By' : 'Served By (Waiter)'

  // Unified print button handler — saves order if needed, then shows preview + prints specific type
  const handlePrintButton = async (type) => {
    if (tokensClosed) { 
      try { alert('Day is closed. Processing payments is disabled until reopened.') } catch {} 
      return 
    }
    if (cart.length === 0) return
    if (discountExceeded) {
      try { alert(discountErrorMessage) } catch {}
      return
    }

    try {
      // If order already saved, just show preview + print
      if (finalized && tokenNumber) {
        let html = ''
        if (type === 'bill') html = receiptHtml || generateReceiptHtmlSilent({ token: tokenNumber })
        else if (type === 'kot') html = kotHtml || generateKotHtml({ token: tokenNumber, saleData: currentSaleData })
        else if (type === 'paid') html = paidTicketHtml || generatePaidTicketHtml({ token: tokenNumber, saleData: currentSaleData })

        if (!html || html.trim().length === 0) {
          alert('Error: Print content is empty.')
          return
        }
        // Show preview and print
        setReceiptHtml(type === 'bill' ? html : receiptHtml)
        setKotHtml(type === 'kot' ? html : kotHtml)
        setPaidTicketHtml(type === 'paid' ? html : paidTicketHtml)
        setActivePreviewType(type)
        setShowReceiptPreview(true)
        setTimeout(() => { printReceiptSilent(html).catch(() => {}) }, 50)
        return
      }

      // Save order first
      const mapped = cart.map(r => ({
        menuItemId: r.id,
        name: r.name,
        price: Number(r.price) || 0,
        quantity: Number(r.qty) || 1,
        subtotal: (Number(r.price) || 0) * (Number(r.qty) || 1),
      }))
      await setBill(mapped)
      const tk = await nextToken()
      if (!tk) {
        try { alert('Failed to generate token. Please try again.') } catch {}
        return
      }
      setTokenNumber(tk)
      setFinalized(true)
      
      const currentUser = getCurrentUser()
      const isLoyaltyBill = tk > 0 && tk % 100 === 0
      const saleData = {
        token: tk,
        items: mapped,
        total: grandTotal,
        subtotal: total,
        discount: discountAmount,
        discountType: discountMode,
        discountValue: parsedDiscountValue,
        discountPercent: discountDisplayPercent,
        discountAmount: discountAmount,
        deliveryCharges: deliveryAmt,
        taxPercent,
        taxAmount,
        customerName: customerName || 'Walk-in',
        orderType: orderType || 'Take-Away',
        paidAmount,
        cashier: currentUser ? currentUser.name || currentUser.username : '',
        cashierName: currentUser ? currentUser.name || currentUser.username : '',
        cashierId: currentUser ? String(currentUser.id || currentUser._id || '') : null,
        waiterName: selectedWaiter ? (selectedWaiter.name || selectedWaiter.username) : '',
        waiterId: selectedWaiter ? String(selectedWaiter.id || selectedWaiter._id || '') : null,
        waiterRole: selectedWaiter ? selectedWaiter.role : '',
        isLoyaltyBill,
        createdAt: Date.now(),
      }
      const saved = await addSale(saleData)
      if (!saved || saved.error) {
        console.error('[POS] Order save failed:', saved?.error || 'Unknown error')
        try { alert('Order save failed: ' + (saved?.error || 'Unknown error') + '. Please try again.') } catch {}
        setFinalized(false)
        return
      }
      
      // Generate all three print HTMLs
      const receiptData = generateReceiptHtmlSilent({ token: tk })
      const kotData = generateKotHtml({ token: tk, saleData })
      const paidTicketData = generatePaidTicketHtml({ token: tk, saleData })
      
      setReceiptHtml(receiptData)
      setKotHtml(kotData)
      setPaidTicketHtml(paidTicketData)
      setCurrentSaleData(saleData)
      
      if (isLoyaltyBill) {
        setPendingLoyaltyModal({ token: tk, orderId: saved?.id || saved?._id })
        setLoyaltyRequestSent(false)
      }

      // Show preview and print the specific type clicked
      setActivePreviewType(type)
      setShowReceiptPreview(true)
      let htmlToPrint = ''
      if (type === 'bill') htmlToPrint = receiptData
      else if (type === 'kot') htmlToPrint = kotData
      else if (type === 'paid') htmlToPrint = paidTicketData

      if (htmlToPrint && htmlToPrint.trim().length > 0) {
        setTimeout(() => { printReceiptSilent(htmlToPrint).catch(() => {}) }, 50)
      }
    } catch (err) {
      console.error('[POS] handlePrintButton error:', err)
      try { alert('Failed to create order: ' + (err.message || 'Unknown error')) } catch {}
      setFinalized(false)
    }
  }

  const handleOkDone = async () => {
    if (tokensClosed) { 
      try { alert('Day is closed. Processing payments is disabled until reopened.') } catch {} 
      return 
    }
    if (cart.length === 0) return
    if (discountExceeded) {
      try { alert(discountErrorMessage) } catch {}
      return
    }
    try {
    const mapped = cart.map(r => ({
      menuItemId: r.id,
      name: r.name,
      price: Number(r.price) || 0,
      quantity: Number(r.qty) || 1,
      subtotal: (Number(r.price) || 0) * (Number(r.qty) || 1),
    }))
    await setBill(mapped)
    const tk = await nextToken()
    if (!tk) {
      try { alert('Failed to generate token. Please try again.') } catch {}
      return
    }
    setTokenNumber(tk)
    setFinalized(true)
    
    const currentUser = getCurrentUser()
    const isLoyaltyBill = tk > 0 && tk % 100 === 0
    const saleData = {
      token: tk,
      items: mapped,
      total: grandTotal,
      subtotal: total,
      discount: discountAmount,
      discountType: discountMode,
      discountValue: parsedDiscountValue,
      discountPercent: discountDisplayPercent,
      discountAmount: discountAmount,
      deliveryCharges: deliveryAmt,
      taxPercent,
      taxAmount,
      customerName: customerName || 'Walk-in',
      orderType: orderType || 'Take-Away',
      paidAmount,
      cashier: currentUser ? currentUser.name || currentUser.username : '',
      cashierName: currentUser ? currentUser.name || currentUser.username : '',
      cashierId: currentUser ? String(currentUser.id || currentUser._id || '') : null,
      waiterName: selectedWaiter ? (selectedWaiter.name || selectedWaiter.username) : '',
      waiterId: selectedWaiter ? String(selectedWaiter.id || selectedWaiter._id || '') : null,
      waiterRole: selectedWaiter ? selectedWaiter.role : '',
      isLoyaltyBill,
      createdAt: Date.now(),
    }
    const saved = await addSale(saleData)
    if (!saved || saved.error) {
      console.error('[POS] Order save failed:', saved?.error || 'Unknown error')
      try { alert('Order save failed: ' + (saved?.error || 'Unknown error') + '. Please try again.') } catch {}
      setFinalized(false)
      return
    }
    
    // Generate all three print HTMLs
    const receiptData = generateReceiptHtmlSilent({ token: tk })
    const kotData = generateKotHtml({ token: tk, saleData })
    const paidTicketData = generatePaidTicketHtml({ token: tk, saleData })
    
    setReceiptHtml(receiptData)
    setKotHtml(kotData)
    setPaidTicketHtml(paidTicketData)
    setCurrentSaleData(saleData) // Store for reprints
    
    if (isLoyaltyBill) {
      setPendingLoyaltyModal({ token: tk, orderId: saved?.id || saved?._id })
      setLoyaltyRequestSent(false)
    }
    setActivePreviewType('bill')
    setShowReceiptPreview(true)
    } catch (err) {
      console.error('[POS] handleOkDone error:', err)
      try { alert('Failed to create order: ' + (err.message || 'Unknown error')) } catch {}
      setFinalized(false)
    }
  }
  
  const handleLoyaltyApply = async () => {
    if (!loyaltyModal) return
    try {
      await createNotification({
        type: 'loyalty_request',
        title: 'Loyalty Reward Request',
        message: `Cashier ${cashierName} requested loyalty reward for Token #${loyaltyModal.token} (Customer: ${customerName || 'Walk-in'})`,
        fromUserId: currentUser?.id || currentUser?._id,
        fromUserName: cashierName,
        toRole: 'Admin',
        status: 'pending',
        relatedOrderId: loyaltyModal.orderId,
        relatedToken: loyaltyModal.token,
      })
      window.dispatchEvent(new Event('notifications:changed'))
      setLoyaltyRequestSent(true)
    } catch (e) { console.error('Loyalty request failed', e) }
  }

  const handleLoyaltySkip = () => {
    setLoyaltyModal(null)
    setLoyaltyRequestSent(false)
  }

  const handleReceiptOK = () => {
    console.log('[POS] Closing receipt modal')
    // Close modal immediately
    setShowReceiptPreview(false)
    setKotHtml('')
    setPaidTicketHtml('')
    setReceiptHtml('')
    setActivePreviewType('bill')
    setCurrentSaleData(null)
    setReprintAuth(null)
    // Small delay to ensure modal is closed before clearing cart
    setTimeout(() => {
      if (pendingLoyaltyModal) {
        setLoyaltyModal(pendingLoyaltyModal)
        setPendingLoyaltyModal(null)
      } else {
        clearCart()
        setSelectedTableId('')
      }
    }, 100)
  }

  // OK Button — order already saved by handleOkDone, just close modal
  const handleOkSaveOrder = () => {
    handleReceiptOK()
  }

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showReceiptPreview) {
        console.log('[POS] Escape pressed - closing modal')
        handleReceiptOK()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [showReceiptPreview, pendingLoyaltyModal])

  const handleReceiptPrint = () => {
    if (!receiptHtml || receiptHtml.trim().length === 0) {
      alert('Error: Receipt content is empty. Please try generating the receipt again.')
      return
    }
    // Fire-and-forget print - completely non-blocking
    setTimeout(() => {
      printReceiptSilent(receiptHtml).then(ok => {
        if (!ok) console.log('Customer Bill print failed')
      }).catch(() => {}) // Silently ignore errors
    }, 10)
  }

  const handleKotPrint = () => {
    if (!kotHtml || kotHtml.trim().length === 0) {
      alert('Error: KOT content is empty.')
      return
    }
    // Fire-and-forget print - completely non-blocking
    setTimeout(() => {
      printReceiptSilent(kotHtml).then(ok => {
        if (!ok) console.log('KOT print failed')
      }).catch(() => {}) // Silently ignore errors
    }, 10)
  }

  const handlePaidTicketPrint = () => {
    if (!paidTicketHtml || paidTicketHtml.trim().length === 0) {
      alert('Error: Paid Ticket content is empty.')
      return
    }
    // Fire-and-forget print - completely non-blocking
    setTimeout(() => {
      printReceiptSilent(paidTicketHtml).then(ok => {
        if (!ok) console.log('Paid Ticket print failed')
      }).catch(() => {}) // Silently ignore errors
    }, 10)
  }

  // Reprint handlers with admin auth
  const requestReprint = (type) => {
    setReprintAuth({ type, saleData: currentSaleData })
  }

  const handleReprintVerified = (type, saleData) => {
    const tk = saleData?.token || tokenNumber
    if (!tk) return
    
    let html = ''
    if (type === 'bill') {
      html = generateReceiptHtmlSilent({ token: tk })
    } else if (type === 'kot') {
      html = generateKotHtml({ token: tk, saleData })
    } else if (type === 'paid') {
      html = generatePaidTicketHtml({ token: tk, saleData })
    }
    
    if (html) {
      // Run print in background - don't await
      printReceiptSilent(html).then(() => {
        alert(`${type === 'bill' ? 'Customer Bill' : type === 'kot' ? 'KOT' : 'Paid Ticket'} reprinted successfully!`)
      }).catch(err => {
        alert(`Reprint error: ${err.message || err}`)
      })
    }
    setReprintAuth(null)
  }

  const categories = [
    { id: 'all', label: 'All Items', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>
    )},
    { id: 'foods', label: 'Food', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
        <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
        <line x1="6" y1="1" x2="6" y2="4"/>
        <line x1="10" y1="1" x2="10" y2="4"/>
        <line x1="14" y1="1" x2="14" y2="4"/>
      </svg>
    )},
    { id: 'deals', label: 'Deals', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="9" r="5"/>
        <path d="M15 9h.01"/>
        <path d="M20 20l-4.35-4.35"/>
        <path d="M9 4v5"/>
        <path d="M4 9h5"/>
      </svg>
    )},
    { id: 'drinks', label: 'Drinks', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 8h1a4 4 0 0 1 0 4h-1"/>
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z"/>
        <line x1="6" y1="2" x2="6" y2="4"/>
        <line x1="10" y1="2" x2="10" y2="4"/>
        <line x1="14" y1="2" x2="14" y2="4"/>
      </svg>
    )},
    { id: 'extras', label: 'Extras', icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="16"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    )},
  ]

  const orderTypes = [
    { id: 'dine-in', label: 'Dine In' },
    { id: 'take-away', label: 'Take Away' },
    { id: 'delivery', label: 'Delivery' },
  ]

  return (
    <section className="pos-layout">
      <div className="pos-body">
        {/* Main Content - Items Grid */}
        <main className="pos-main">
        {tokensClosed && (
          <div className="card" style={{marginBottom:16, borderLeft:'4px solid #dc2626'}}>
            <div style={{display:'flex', alignItems:'center', gap:12, color:'#dc2626', fontWeight:600}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Day is closed. New orders cannot be placed.
            </div>
          </div>
        )}
        
        <div className="pos-header">
          <h1 className="pos-title">
            {categories.find(c => c.id === activeCategory)?.label || 'All Items'}
          </h1>
          <div className="pos-search">
            <svg className="pos-search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="M21 21l-4.35-4.35"/>
            </svg>
            <input 
              type="text" 
              placeholder="Search items..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="pos-items">
          {filtered.map((item) => {
            const itemId = toId(item.id || item._id)
            const stableKey = itemId || `${item.category || 'item'}-${item.name || 'unknown'}`
            return (
            <div 
              key={stableKey} 
              className="pos-item"
              onClick={() => { if (!tokensClosed) addToCart(item) }}
            >
              <div className="pos-item-image" style={{background: item.category === 'drinks' ? 'linear-gradient(135deg, #e0f2fe, #bae6fd)' : item.category === 'deals' ? 'linear-gradient(135deg, #dcfce7, #bbf7d0)' : 'linear-gradient(135deg, #fef3c7, #fde68a)'}}>
                {item.img || item.image ? (
                  <img src={item.img || item.image} alt={item.name} onError={(e)=>{e.currentTarget.style.display='none'}} />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                )}
                {item.category === 'deals' && <span className="pos-item-badge">DEAL</span>}
              </div>
              <div className="pos-item-info">
                <div className="pos-item-name">{item.name}</div>
                <div className="pos-item-type">{item.type || item.categoryLabel}</div>
                <div className="pos-item-footer">
                  <span className="pos-item-price">Rs.{item.price}</span>
                  {(() => {
                    const cartItem = cart.find(r => String(r.id) === String(itemId))
                    if (cartItem) {
                      return (
                        <div className="pos-item-qty-control">
                          <button className="pos-qty-btn pos-qty-minus" onClick={(e) => { e.stopPropagation(); if (cartItem.qty > 1) { changeQty(itemId, cartItem.qty - 1) } else { removeRow(itemId) } }} disabled={tokensClosed}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          </button>
                          <span className="pos-qty-value">{cartItem.qty}</span>
                          <button className="pos-qty-btn pos-qty-plus" onClick={(e) => { e.stopPropagation(); if (!tokensClosed) addToCart(item) }} disabled={tokensClosed}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          </button>
                        </div>
                      )
                    }
                    return (
                      <button
                        className="pos-item-add-btn"
                        onClick={(e) => { e.stopPropagation(); if (!tokensClosed) addToCart(item) }}
                        disabled={tokensClosed}
                      >
                        Add to Dish
                      </button>
                    )
                  })()}
                </div>
              </div>
            </div>
          )})}
          {filtered.length === 0 && (
            <div className="order-empty" style={{gridColumn:'1 / -1'}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <div>No items found</div>
            </div>
          )}
        </div>
      </main>
      </div>{/* pos-body */}

      {/* Order Panel */}
      <aside className="pos-order">
        <div className="pos-order-header">
          <div className="pos-order-title">Current Order</div>
          <div className="pos-order-subtitle">{tokenNumber ? `Token #${tokenNumber}` : 'New Order'}</div>
          {cashierName && <div className="muted" style={{fontSize:12}}>Cashier: {cashierName}</div>}
        </div>

        <div className="order-type-tabs">
          {orderTypes.map(type => (
            <button 
              key={type.id}
              className={`order-type-tab ${orderType===type.id?'active':''}`}
              onClick={()=>setOrderType(type.id)}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="order-customer">
          <label>Customer Name</label>
          <input 
            placeholder="Enter customer name"
            value={customerName} 
            onChange={(e)=>setCustomerName(e.target.value)} 
          />
        </div>

        {orderType==='dine-in' && (
          <div className="order-customer" style={{borderBottom:'none', paddingTop:0}}>
            <label>Table Number</label>
            <select className="input" style={{width:'100%', padding:'12px 16px', border:'2px solid #e2e8f0', borderRadius:'10px'}} value={selectedTableId} onChange={(e) => setSelectedTableId(e.target.value)}>
              <option value="">Select table</option>
              {tables.length === 0 ? (
                <option value="" disabled>No tables available</option>
              ) : (
                tables.map((t, idx) => {
                  const tableId = toId(t.id || t._id) || String(t.number || t.tableNumber || idx)
                  const tableNo = t.number || t.tableNumber || tableId
                  return <option key={tableId} value={tableId}>{t.floor ? `${t.floor} - ` : ''}Table {tableNo} ({t.seats || t.capacity || 4} seats)</option>
                })
              )}
            </select>
          </div>
        )}

        {/* Waiter / Staff dropdown */}
        <div className="order-customer" style={{borderBottom:'none', paddingTop: orderType==='dine-in' ? 0 : undefined}}>
          <label>{waiterLabel} (Optional)</label>
          <select
            className="input"
            style={{width:'100%', padding:'12px 16px', border:'2px solid #e2e8f0', borderRadius:'10px'}}
            value={selectedWaiterId}
            onChange={(e) => setSelectedWaiterId(e.target.value)}
          >
            <option value="">-- Select Staff --</option>
            {staffUsers.length === 0 ? (
              <option value="" disabled>No staff found</option>
            ) : (
              staffUsers.map((u, idx) => {
                const staffId = toId(u.id || u._id) || String(idx)
                return <option key={staffId} value={staffId}>{u.name || u.username} — {u.role}</option>
              })
            )}
          </select>
        </div>

        <div className="order-items">
          {cart.length === 0 ? (
            <div className="order-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 2v2M15 2v2M12 2v8M8 12h8M7 17h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"/>
              </svg>
              <div>Your order is empty</div>
              <div style={{fontSize:'12px', marginTop:'4px'}}>Click items to add them</div>
            </div>
          ) : (
            cart.map(row => {
              const sourceItem = allItems.find(i => String(toId(i.id || i._id)) === String(row.id))
              return (
                <div className="order-item-row" key={String(row.id || Math.random())}>
                  <div className="order-item-main">
                    <div className="order-item-thumb">
                      {sourceItem?.img || sourceItem?.image ? (
                        <img src={sourceItem.img || sourceItem.image} alt={row.name} />
                      ) : (
                        <div className="order-thumb-placeholder">{row.name.charAt(0)}</div>
                      )}
                    </div>
                    <div className="order-item-info">
                      <div className="order-item-name">{row.name}</div>
                      <div className="order-item-meta">Rs.{row.price} each</div>
                    </div>
                    <button className="order-item-remove" onClick={()=>removeRow(String(row.id))}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                  <div className="order-item-controls">
                    <div className="order-item-qty">
                      <button className="order-qty-btn" onClick={()=>changeQty(String(row.id), Math.max(1, (row.qty||1)-1))}>−</button>
                      <span className="order-qty-value">{row.qty}</span>
                      <button className="order-qty-btn" onClick={()=>changeQty(String(row.id), (row.qty||1)+1)}>+</button>
                    </div>
                    <div className="order-item-price">Rs.{(row.price*row.qty).toFixed(0)}</div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="order-summary">
          <div style={{marginBottom: 12}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8}}>
              <span style={{fontWeight: 600}}>Discount</span>
              <div style={{display: 'inline-flex', border: '1px solid #cbd5e1', borderRadius: 9999, overflow: 'hidden'}}>
                <button
                  type="button"
                  onClick={() => setDiscountMode('percent')}
                  style={{padding: '8px 12px', border: 'none', backgroundColor: discountMode === 'percent' ? '#2563eb' : '#fff', color: discountMode === 'percent' ? '#fff' : '#475569', cursor: 'pointer'}}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountMode('fixed')}
                  style={{padding: '8px 12px', border: 'none', backgroundColor: discountMode === 'fixed' ? '#2563eb' : '#fff', color: discountMode === 'fixed' ? '#fff' : '#475569', cursor: 'pointer'}}
                >
                  Rs.
                </button>
              </div>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <input
                type="number"
                min="0"
                step="0.1"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountMode === 'percent' ? 'Enter %' : 'Enter Rs.'}
                style={{width: '100%', padding: '10px 12px', borderRadius: 10, border: '2px solid #e2e8f0', outline: 'none'}}
              />
              <span style={{minWidth: 36, textAlign: 'center', color: '#475569', fontWeight: 600}}>{discountMode === 'percent' ? '%' : 'Rs.'}</span>
            </div>
            {discountErrorMessage && (
              <div style={{color: '#dc2626', fontSize: 12, marginTop: 6}}>{discountErrorMessage}</div>
            )}
          </div>

          <div className="order-summary-row">
            <span>Subtotal</span>
            <span>Rs.{total.toFixed(0)}</span>
          </div>
          {deliveryAmt > 0 && (
            <div className="order-summary-row">
              <span>Delivery</span>
              <span>Rs.{deliveryAmt}</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="order-summary-row discount">
              <span>Discount ({Number(discountDisplayPercent).toFixed(2).replace(/\.00$/, '')}%)</span>
              <span>-Rs.{discountAmount.toFixed(0)}</span>
            </div>
          )}
          <div className="order-summary-row">
            <span>Tax</span>
            <span>Rs.{taxAmount.toFixed(0)}</span>
          </div>
          <div className="order-summary-row total">
            <span>Total</span>
            <span>Rs.{grandTotal.toFixed(0)}</span>
          </div>
        </div>

        <div className="order-actions" style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
          <button 
            className="order-btn-print" 
            onClick={() => handlePrintButton('bill')} 
            disabled={cart.length===0 || tokensClosed || discountExceeded}
            style={{flex:'1',minWidth:'70px',backgroundColor:'#007bff'}}
          >
            Bill
          </button>
          <button 
            className="order-btn-print" 
            onClick={() => handlePrintButton('kot')} 
            disabled={cart.length===0 || tokensClosed || discountExceeded}
            style={{flex:'1',minWidth:'70px',backgroundColor:'#ff6b35'}}
          >
            KOT
          </button>
          <button 
            className="order-btn-print" 
            onClick={() => handlePrintButton('paid')} 
            disabled={cart.length===0 || tokensClosed || discountExceeded}
            style={{flex:'1',minWidth:'70px',backgroundColor:'#6c757d'}}
          >
            Paid
          </button>
          <button 
            className="order-btn-print" 
            onClick={handleOkSaveOrder} 
            disabled={!finalized}
            style={{flex:'1',minWidth:'70px',backgroundColor:'#28a745'}}
          >
            OK
          </button>
        </div>
      </aside>

      {/* Receipt Preview Modal */}
      {showReceiptPreview && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          boxSizing: 'border-box',
          pointerEvents: 'auto'
        }} onClick={handleReceiptOK}>
          
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '25px',
            width: '100%',
            maxWidth: '450px',
            maxHeight: '90vh',
            overflow: 'hidden',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            position: 'relative',
            margin: '0 auto'
          }} onClick={(e)=>e.stopPropagation()}>
            
            {/* Preview type tabs */}
            <div style={{
              display: 'flex',
              gap: '4px',
              marginBottom: '15px',
              borderBottom: '2px solid #f0f0f0',
              paddingBottom: '10px'
            }}>
              {['bill','kot','paid'].map(t => (
                <button
                  key={t}
                  onClick={() => {
                    setActivePreviewType(t)
                    let html = ''
                    if (t === 'bill') html = receiptHtml
                    else if (t === 'kot') html = kotHtml
                    else if (t === 'paid') html = paidTicketHtml
                    if (html && html.trim().length > 0) {
                      setTimeout(() => { printReceiptSilent(html).catch(() => {}) }, 50)
                    }
                  }}
                  style={{
                    flex: '1',
                    padding: '8px 10px',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    backgroundColor: activePreviewType === t
                      ? (t === 'bill' ? '#007bff' : t === 'kot' ? '#ff6b35' : '#6c757d')
                      : '#e9ecef',
                    color: activePreviewType === t ? 'white' : '#495057'
                  }}
                >
                  {t === 'bill' ? 'Bill' : t === 'kot' ? 'KOT' : 'Paid'}
                </button>
              ))}
            </div>
            
            {/* Preview content — shows only the active type */}
            <div style={{
              border: '1px solid #e0e0e0',
              padding: '15px',
              marginBottom: '15px',
              backgroundColor: '#fafafa',
              borderRadius: '8px',
              maxHeight: '400px',
              overflowY: 'auto',
              overflowX: 'hidden',
              textAlign: 'center'
            }}>
              <div dangerouslySetInnerHTML={{__html: 
                activePreviewType === 'bill' ? receiptHtml 
                : activePreviewType === 'kot' ? kotHtml 
                : paidTicketHtml
              }} />
            </div>
            
            {/* OK + Reprint Buttons */}
            <div style={{
              display: 'flex',
              gap: '8px',
              justifyContent: 'center',
              marginBottom: '12px'
            }}>
              <button
                onClick={handleOkSaveOrder}
                style={{
                  backgroundColor: '#28a745',
                  color: 'white',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  flex: '1'
                }}
                title="OK - Close and finish"
              >
                OK
              </button>
            </div>

            {/* Reprint Section */}
            <div style={{
              borderTop: '1px solid #e0e0e0',
              paddingTop: '12px'
            }}>
              <div style={{fontSize: '12px', fontWeight: '600', color: '#666', textAlign: 'center', marginBottom: '8px'}}>
                Reprint? (Admin Auth Required)
              </div>
              <div style={{
                display: 'flex',
                gap: '6px',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}>
                <button 
                  onClick={() => requestReprint('bill')}
                  style={{
                    backgroundColor: '#ffc107',
                    color: '#000',
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}
                >
                  Reprint Bill
                </button>
                <button 
                  onClick={() => requestReprint('kot')}
                  style={{
                    backgroundColor: '#ffc107',
                    color: '#000',
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}
                >
                  Reprint KOT
                </button>
                <button 
                  onClick={() => requestReprint('paid')}
                  style={{
                    backgroundColor: '#ffc107',
                    color: '#000',
                    padding: '6px 12px',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}
                >
                  Reprint Paid
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}

      {/* Loyalty Bill Modal */}
      {loyaltyModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }} onClick={handleLoyaltySkip}>
          <div style={{
            backgroundColor: 'white', borderRadius: '16px', padding: '30px',
            width: '100%', maxWidth: '420px', textAlign: 'center',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: '#d97706' }}>
              This is a Loyalty Bill!
            </div>
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 20 }}>
              Token #{loyaltyModal.token} — Apply special reward for customer?
            </div>
            {loyaltyRequestSent ? (
              <div style={{ padding: '12px 16px', background: '#fef9c3', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#92400e', marginBottom: 12 }}>
                Reward request sent to Admin ⏳
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  onClick={handleLoyaltyApply}
                  style={{ padding: '12px 24px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 700 }}
                >Apply Reward</button>
                <button
                  onClick={handleLoyaltySkip}
                  style={{ padding: '12px 24px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 700 }}
                >Skip</button>
              </div>
            )}
            {loyaltyRequestSent && (
              <button onClick={handleLoyaltySkip} style={{ marginTop: 12, padding: '8px 16px', background: 'none', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#6b7280' }}>Close</button>
            )}
          </div>
        </div>
      )}

      {/* Admin Auth Modal for Reprint */}
      {reprintAuth && (
        <AdminAuthModal
          onVerified={(adminName) => {
            handleReprintVerified(reprintAuth.type, reprintAuth.saleData)
          }}
          onCancel={() => setReprintAuth(null)}
        />
      )}
    </section>
  )
}
