import { useEffect, useState } from 'react'
import { getActiveBusinessDateId } from '../utils/storage.js'

export default function BusinessDateBadge(){
  const [bizDate, setBizDate] = useState(() => {
    try { return getActiveBusinessDateId() } catch { return '' }
  })

  useEffect(() => {
    const refresh = () => {
      try { setBizDate(getActiveBusinessDateId()) } catch { setBizDate('') }
    }
    refresh()
    window.addEventListener('day:status-changed', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('day:status-changed', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  return (
    <div style={{display:'flex', justifyContent:'flex-end'}}>
      <div className="muted" style={{fontSize:12}}>Business Date: <b>{bizDate || '-'}</b></div>
    </div>
  )
}
