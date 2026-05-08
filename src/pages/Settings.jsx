import { useEffect, useState } from 'react'
import { useDialog } from '../components/ConfirmProvider.jsx'
import { getRestaurantInfo, setRestaurantInfo, exportUsers, importUsers, exportAllData, importAllData, wipeAllData, isTokenClosed, isTokenClosedSync, closeTokens, openTokens, StorageKeys, ensureTokenDay, getBusinessHours, setBusinessHours, getPrinterConfig, setPrinterConfig, setActiveBusinessDateId, getActiveBusinessDateId, forceSetBusinessDateId } from '../utils/storage.js'

export default function Settings() {
  // Company profile
  const [company, setCompany] = useState({ name: '', phone: '', address: '', logo: '' })
  const [bizHours, setBizHours] = useState({ open: '06:00', close: '03:00' })
  const [selectedBusinessDate, setSelectedBusinessDate] = useState('')
  const [currentBusinessDate, setCurrentBusinessDate] = useState('')
  const [printerConfig, setPrinterConfigState] = useState({ printerName: '', enabled: true })
  const [availablePrinters, setAvailablePrinters] = useState([])
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const dialog = useDialog()

  useEffect(() => {
    const info = getRestaurantInfo()
    if (info) setCompany(info)
    getBusinessHours().then(v => setBizHours(v)).catch(()=>{})
    const printer = getPrinterConfig()
    if (printer) setPrinterConfigState(printer)
    setCurrentBusinessDate(getActiveBusinessDateId())
    ensureTokenDay().catch(()=>{})
    loadPrinters()
    
    const handleFocus = () => {
      console.log('Window focused, refreshing printers...')
      loadPrinters()
    }

    const handleDayStatusChanged = () => {
      setCurrentBusinessDate(getActiveBusinessDateId())
      const info = getRestaurantInfo()
      if (info) setCompany(info)
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('day:status-changed', handleDayStatusChanged)
    
    // Also refresh printers every 10 seconds to catch newly connected printers
    const interval = setInterval(() => {
      console.log('Auto-refreshing printers...')
      loadPrinters()
    }, 10000) // 10 seconds
    
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('day:status-changed', handleDayStatusChanged)
      clearInterval(interval)
    }
  }, [])

  const loadPrinters = async () => {
    if (!window.burgerPos || !window.burgerPos.getPrinterList) {
      console.warn('Printer API not available')
      return
    }
    
    setLoadingPrinters(true)
    try {
      const result = await window.burgerPos.getPrinterList()
      if (result.success) {
        const newPrinters = result.printers || []
        
        // Check if printer list has changed
        const oldCount = availablePrinters.length
        const newCount = newPrinters.length
        
        if (newCount > oldCount) {
          console.log(`✓ New printer(s) detected! (${newCount - oldCount} added)`)
        } else if (newCount < oldCount) {
          console.log(`⚠ Printer(s) removed! (${oldCount - newCount} removed)`)
        }
        
        setAvailablePrinters(newPrinters)
        
        // If configured printer is no longer available, show warning
        if (printerConfig.enabled && printerConfig.printerName) {
          const stillExists = newPrinters.find(p => p.name === printerConfig.printerName)
          if (!stillExists && newPrinters.length > 0) {
            console.warn(`⚠ Configured printer "${printerConfig.printerName}" not found!`)
          }
        }
      } else {
        console.error('Failed to load printers:', result.error)
      }
    } catch (error) {
      console.error('Error loading printers:', error)
    } finally {
      setLoadingPrinters(false)
    }
  }

  const handleCompanyChange = (k, v) => setCompany(prev => ({ ...prev, [k]: v }))
  const handleCompanySave = async () => {
    await setRestaurantInfo(company)
    try { window.dispatchEvent(new Event('restaurantInfo:updated')) } catch {}
    await dialog.alert({ title: 'Saved', description: 'Company profile saved.' })
  }
  const onLogoSelect = async (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCompany(prev => ({ ...prev, logo: reader.result }))
    reader.readAsDataURL(file)
  }
  const onLogoRemove = async () => {
    setCompany(prev => ({ ...prev, logo: '' }))
    await setRestaurantInfo({ ...company, logo: '' })
    try { window.dispatchEvent(new Event('restaurantInfo:updated')) } catch {}
    await dialog.alert({ title: 'Logo removed', description: 'Company logo has been cleared.' })
  }

  // Data management (moved from Users page)
  const doExport = async () => {
    const data = await exportUsers()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'users.json'; a.click(); URL.revokeObjectURL(url)
  }
  const doImport = async (file) => {
    if (!file) return
    const text = await file.text()
    await importUsers(text)
    await dialog.alert({ title: 'Imported', description: 'Users imported.' })
  }

  // Full data import/export
  const doExportAll = async () => {
    const data = await exportAllData()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'restaurant-data-backup.json'; a.click(); URL.revokeObjectURL(url)
  }
  const doImportAll = async (file) => {
    if (!file) return
    const text = await file.text()
    const ok = await importAllData(text)
    if (ok) {
      try { window.dispatchEvent(new Event('restaurantInfo:updated')) } catch {}
    }
    await dialog.alert({ title: ok ? 'Imported' : 'Failed', description: ok ? 'All data imported.' : 'Import failed. Check the file format.' })
  }

  const handlePrinterSave = async () => {
    if (!printerConfig.printerName) {
      await dialog.alert({ title: 'Select a printer', description: 'Please select a printer. Receipts will only print to the selected printer.' })
      return
    }
    await setPrinterConfig({ printerName: printerConfig.printerName, enabled: true })
    await dialog.alert({ title: 'Saved', description: 'Printer settings saved successfully.' })
  }

  const handlePrinterTest = async () => {
    // Dialog-based test print (reliable)
    const now = new Date()
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <title>Test Print</title>
    <style>
      @page { size: 80mm auto; margin: 0 }
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family: Arial, sans-serif; width:68mm; margin:0 auto; padding:6mm 4mm; color:#000; font-weight:700}
      .center{text-align:center}
      .hr{border-top:1px dashed #000; margin:8px 0}
    </style></head>
    <body>
      <div class="center" style="font-size:18px; font-weight:700">TEST PRINT (Dialog)</div>
      <div class="center" style="margin-top:6px">Oaklyn POS</div>
      <div class="hr"></div>
      <div>Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}</div>
      <div>Configured Printer: ${printerConfig.printerName || '-'}</div>
      <div class="hr"></div>
      <div>0123456789</div>
      <div>ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
      <div>abcdefghijklmnopqrstuvwxyz</div>
      <div>Rs.100.00</div>
      <div class="center" style="margin-top:12px">If you can read this, printing works.</div>
      <div style="height:20px"></div>
    </body></html>`
    try {
      if (window.burgerPos && window.burgerPos.printWithDialog) {
        const res = await window.burgerPos.printWithDialog(html)
        if (res && res.success) return
      }
      // Browser fallback
      const w = window.open('', '_blank', 'width=400,height=600')
      if (!w) { await dialog.alert({ title: 'Pop-up blocked', description: 'Allow pop-ups and try again.' }); return }
      w.document.write(html); w.document.close();
      setTimeout(()=>{ try { w.focus(); w.print(); setTimeout(()=>w.close(), 800) } catch {} }, 400)
    } catch (e) {
      await dialog.alert({ title: 'Error', description: String(e && e.message ? e.message : e) })
    }
  }

  const handlePrinterTestSilent = async () => {
    if (!printerConfig.printerName) {
      await dialog.alert({ title: 'No printer selected', description: 'Select a printer first, then try test print.' })
      return
    }
    if (!(window.burgerPos && window.burgerPos.printSilentToPrinter)) {
      await dialog.alert({ title: 'Unavailable', description: 'Silent print API not available. Please run the packaged app.' })
      return
    }
    const now = new Date()
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <title>Test Print</title>
    <style>
      @page { size: 80mm auto; margin: 0 }
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family: Arial, sans-serif; width:68mm; margin:0 auto; padding:6mm 4mm; color:#000; font-weight:700}
      .center{text-align:center}
      .hr{border-top:1px dashed #000; margin:8px 0}
    </style></head>
    <body>
      <div class="center" style="font-size:18px; font-weight:700">TEST PRINT (Silent)</div>
      <div class="center" style="margin-top:6px">Oaklyn POS</div>
      <div class="hr"></div>
      <div>Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}</div>
      <div>Printer: ${printerConfig.printerName}</div>
      <div class="hr"></div>
      <div>0123456789</div>
      <div>ABCDEFGHIJKLMNOPQRSTUVWXYZ</div>
      <div>abcdefghijklmnopqrstuvwxyz</div>
      <div>Rs.100.00</div>
      <div class="center" style="margin-top:12px">If you can read this, printing works.</div>
      <div style="height:20px"></div>
    </body></html>`
    try {
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
      let result = await Promise.race([
        window.burgerPos.printSilentToPrinter(dataUrl, printerConfig.printerName),
        new Promise(resolve => setTimeout(() => resolve({success:false, error:'Timeout'}), 4000)),
      ])
      if (!(result && result.success)) {
        result = await Promise.race([
          window.burgerPos.printSilentToPrinter(html, printerConfig.printerName),
          new Promise(resolve => setTimeout(() => resolve({success:false, error:'Timeout2'}), 4000)),
        ])
      }
      if (!(result && result.success)) {
        await dialog.alert({ title: 'Silent print failed', description: result && result.error ? String(result.error) : 'Unknown error' })
      }
    } catch (e) {
      await dialog.alert({ title: 'Error', description: String(e && e.message ? e.message : e) })
    }
  }

  const handlePrinterTestSilentPlain = async () => {
    if (!printerConfig.printerName) {
      await dialog.alert({ title: 'No printer selected', description: 'Select a printer first, then try test print.' })
      return
    }
    if (!(window.burgerPos && window.burgerPos.printSilentToPrinter)) {
      await dialog.alert({ title: 'Unavailable', description: 'Silent print API not available. Please run the packaged app.' })
      return
    }
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <title>Plain Test</title></head>
    <body style="width:68mm;margin:0 auto;padding:6mm 4mm;color:#000;font-family:ui-monospace,Consolas,monospace;">
      <pre>
SILENT PLAIN TEST\n==================\n1234567890\nABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\nTotal: Rs.100.00
      </pre>
      <div style="height:20px"></div>
    </body></html>`
    try {
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
      let result = await Promise.race([
        window.burgerPos.printSilentToPrinter(dataUrl, printerConfig.printerName),
        new Promise(resolve => setTimeout(() => resolve({success:false, error:'Timeout'}), 4000)),
      ])
      if (!(result && result.success)) {
        result = await Promise.race([
          window.burgerPos.printSilentToPrinter(html, printerConfig.printerName),
          new Promise(resolve => setTimeout(() => resolve({success:false, error:'Timeout2'}), 4000)),
        ])
      }
      if (!(result && result.success)) {
        await dialog.alert({ title: 'Silent plain test failed', description: result && result.error ? String(result.error) : 'Unknown error' })
      }
    } catch (e) {
      await dialog.alert({ title: 'Error', description: String(e && e.message ? e.message : e) })
    }
  }

  const handlePrinterTestSilentDefault = async () => {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8" />
    <title>Default Silent Test</title></head>
    <body style="width:68mm;margin:0 auto;padding:6mm 4mm;color:#000;font-family:ui-monospace,Consolas,monospace;">
      <pre>
SILENT DEFAULT TEST\n===================\n1234567890\nABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\nTotal: Rs.100.00
      </pre>
      <div style="height:20px"></div>
    </body></html>`
    try {
      if (!(window.burgerPos && window.burgerPos.printSilentToPrinterDefault)) {
        await dialog.alert({ title: 'Unavailable', description: 'Default silent route not available. Please restart the packaged app.' })
        return
      }
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
      let result = await window.burgerPos.printSilentToPrinterDefault(dataUrl)
      if (!(result && result.success)) {
        result = await window.burgerPos.printSilentToPrinterDefault(html)
      }
      if (!(result && result.success)) {
        await dialog.alert({ title: 'Silent default failed', description: result && result.error ? String(result.error) : 'Unknown error' })
      }
    } catch (e) {
      await dialog.alert({ title: 'Error', description: String(e && e.message ? e.message : e) })
    }
  }

  const handleSetBusinessDate = async () => {
    if (!selectedBusinessDate) {
      await dialog.alert({ title: 'Select Date', description: 'Please select a business date first.' })
      return
    }
    const ok = await dialog.confirm({ 
      title: 'Set Business Date', 
      description: `Set business date to ${selectedBusinessDate}? This will be used when you open the day.` 
    })
    if (!ok) return
    
    try {
      await forceSetBusinessDateId(selectedBusinessDate)
      setCurrentBusinessDate(selectedBusinessDate)
      await dialog.alert({ 
        title: 'Business Date Set', 
        description: `Business date set to ${selectedBusinessDate}. When you open the day, this date will be used and will continue until day close.` 
      })
    } catch (e) {
      await dialog.alert({ title: 'Error', description: String(e && e.message ? e.message : e) })
    }
  }

  return (
    <section>
      <h1>Settings</h1>

      <div className="grid2">
        <div className="card">
          <div className="card-title">Company Profile</div>
          <div className="form">
            <label>Name</label>
            <input className="input" value={company.name || ''} onChange={e => handleCompanyChange('name', e.target.value)} placeholder="Company Name" />
          </div>
          <div className="form">
            <label>Phone</label>
            <input className="input" value={company.phone || ''} onChange={e => handleCompanyChange('phone', e.target.value)} placeholder="Phone" />
          </div>
          <div className="form">
            <label>Address</label>
            <input className="input" value={company.address || ''} onChange={e => handleCompanyChange('address', e.target.value)} placeholder="Address" />
          </div>
          <div className="form">
            <label>Logo</label>
            <input type="file" accept="image/*" onChange={e => onLogoSelect(e.target.files?.[0])} />
            {company.logo && (
              <div style={{ marginTop: 8 }}>
                <img src={company.logo} alt="logo" style={{ height: 60, display:'block', marginBottom:8 }} />
                <button className="btn danger" onClick={onLogoRemove}>Remove Logo</button>
              </div>
            )}
          </div>
          <div className="actions">
            <button className="btn primary" onClick={handleCompanySave}>Save Company</button>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Business Hours</div>
          <div className="grid2">
            <div className="form">
              <label>Opening Time</label>
              <input className="input" type="time" value={bizHours.open} onChange={e=>setBizHours(h=>({...h, open:e.target.value}))} />
            </div>
            <div className="form">
              <label>Closing Time</label>
              <input className="input" type="time" value={bizHours.close} onChange={e=>setBizHours(h=>({...h, close:e.target.value}))} />
            </div>
          </div>
          <div className="muted">If closing time is earlier than opening time, the business day continues past midnight (overnight shift).</div>
          <div className="actions">
            <button className="btn" onClick={async ()=>{ await setBusinessHours(bizHours); await dialog.alert({ title: 'Saved', description: 'Business hours saved.' }) }}>Save Hours</button>
          </div>
          
          <div style={{marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)'}}>
            <div className="form">
              <label>Set Custom Business Date</label>
              <input 
                className="input" 
                type="date" 
                value={selectedBusinessDate} 
                onChange={e=>setSelectedBusinessDate(e.target.value)} 
                placeholder="Select business date"
              />
            </div>
            <div className="muted" style={{marginTop: 8}}>
              Select a specific date to use as the business date. When you open the day, this date will be used and will continue until day close. The next day will automatically increment from this date.
            </div>
            <div className="muted" style={{marginTop: 4}}>
              Current Business Date: <strong>{currentBusinessDate || 'Not set'}</strong>
            </div>
            <div className="actions" style={{marginTop: 12}}>
              <button className="btn primary" onClick={handleSetBusinessDate} disabled={!selectedBusinessDate}>
                Set Business Date
              </button>
              <button className="btn" onClick={()=>setSelectedBusinessDate('')}>Clear Selection</button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Printer Settings</div>
          <div className="muted" style={{marginBottom: 12}}>Select your receipt printer. Receipts will print directly to this printer without any dialog.</div>
          <div className="form">
            <label>Select Printer ({availablePrinters.length} found)</label>
            <select 
              className="input" 
              value={printerConfig.printerName} 
              onChange={e => setPrinterConfigState(prev => ({...prev, printerName: e.target.value}))}
              disabled={loadingPrinters}
            >
              <option value="">-- Select Printer --</option>
              {availablePrinters.map(printer => (
                <option key={printer.name} value={printer.name}>
                  {printer.displayName || printer.name}
                </option>
              ))}
            </select>
            {availablePrinters.length === 0 && !loadingPrinters && (
              <div className="muted" style={{color: 'var(--danger)', marginTop: 4}}>No printers found. Please install a printer and click "Refresh Printers".</div>
            )}
            {loadingPrinters && (
              <div className="muted" style={{marginTop: 4}}>Detecting printers...</div>
            )}
            {availablePrinters.length > 0 && !loadingPrinters && (
              <div className="muted" style={{marginTop: 4, color: 'var(--success)'}}>✓ Auto-refreshing every 10 seconds</div>
            )}
          </div>

          <div className="actions">
            <button className="btn" onClick={loadPrinters} disabled={loadingPrinters}>Refresh Printers</button>
            <button className="btn primary" onClick={handlePrinterSave}>Save Printer Settings</button>
            <button className="btn" onClick={handlePrinterTest}>Test Print (Dialog)</button>
            <button className="btn" onClick={handlePrinterTestSilent}>Test Silent</button>
            <button className="btn" onClick={handlePrinterTestSilentPlain}>Test Silent (Plain)</button>
            <button className="btn" onClick={handlePrinterTestSilentDefault}>Test Silent (Default)</button>
          </div>

          {printerConfig.printerName && (
            <div style={{marginTop: 12, padding: 10, background: 'var(--bg)', borderRadius: 4}}>
              <div className="muted">✓ Receipts will print to: <strong>{printerConfig.printerName}</strong></div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-title">Data Management</div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={doExport}>Export Users</button>
            <label className="btn">
              Import Users
              <input type="file" accept="application/json" style={{ display: 'none' }} onChange={e => doImport(e.target.files?.[0])} />
            </label>
            <span className="muted" style={{margin:'0 6px'}}>•</span>
            <button className="btn primary" onClick={doExportAll}>Export All Data</button>
            <label className="btn">
              Import All Data
              <input type="file" accept="application/json" style={{ display: 'none' }} onChange={e => doImportAll(e.target.files?.[0])} />
            </label>
            <button className="btn danger" onClick={async () => {
              const ok1 = await dialog.confirm({ title: 'Delete All Data', description: 'This will delete ALL app data including items, sales, returns, and users. Continue?' })
              if (!ok1) return
              const ok2 = await dialog.confirm({ title: 'Are you absolutely sure?', description: 'This cannot be undone.' })
              if (!ok2) return
              await wipeAllData()
              setCompany({ name: '', phone: '', address: '', logo: '' })
              try { window.dispatchEvent(new Event('restaurantInfo:updated')) } catch {}
              await dialog.alert({ title: 'Deleted', description: 'All data removed.' })
            }}>Delete All Data</button>
          </div>
        </div>
      </div>

      {false && (
        <div className="card" style={{marginTop:12}}>
          <div className="card-title">Token Settings</div>
          <div className="row" style={{justifyContent:'space-between', flexWrap:'wrap'}}>
            <div>
              <div className="muted">Tokens start from 1 each day automatically.</div>
              <div className="muted">Current status: <strong>{isTokenClosedSync() ? 'Closed' : 'Open'}</strong></div>
              <div className="muted">Today's token count: <strong>{(()=>{ try{ return '0' } catch { return '0' } })()}</strong></div>
            </div>
            <div className="actions">
              {isTokenClosedSync() ? (
                <button className="btn primary" onClick={async ()=>{ await openTokens(); alert('Tokens opened. New tokens will generate.'); }}>Open Tokens</button>
              ) : (
                <button className="btn danger" onClick={async ()=>{ await closeTokens(); alert('Tokens closed. New tokens will not generate until reopened.'); }}>Close Tokens</button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
