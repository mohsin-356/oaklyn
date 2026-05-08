import { useEffect, useState } from 'react'
import { getDayOpenAt, isTokenClosed, openDay, getActiveBusinessDateId } from '../utils/storage.js'

export default function DayOpen(){
  const [openedAt, setOpenedAt] = useState(0)
  const [closed, setClosed] = useState(false)

  useEffect(()=>{
    getDayOpenAt().then(v => setOpenedAt(v||0)).catch(()=>{})
    isTokenClosed().then(v => setClosed(v)).catch(()=>{})
  },[])

  const openNow = async () => {
    try {
      await openDay()
      const ts = await getDayOpenAt()
      const cl = await isTokenClosed()
      setOpenedAt(ts||0)
      setClosed(cl)
    } catch {}
  }

  const status = (()=>{
    if (openedAt && !closed) return 'open'
    return 'closed'
  })()

  return (
    <section className="page">
      <h1>Day Open</h1>
      <div className="card">
        <div className="row" style={{justifyContent:'space-between'}}>
          <div className="muted">Current Business Date</div>
          <div><b>{getActiveBusinessDateId()}</b></div>
        </div>
        <div className="row" style={{justifyContent:'space-between'}}>
          <div className="muted">Status</div>
          <div><b style={{textTransform:'capitalize'}}>{status}</b></div>
        </div>
        {openedAt ? (
          <div className="row" style={{justifyContent:'space-between'}}>
            <div className="muted">Opened At</div>
            <div><b>{new Date(openedAt).toLocaleTimeString()}</b></div>
          </div>
        ) : (
          <div className="muted">Day not opened yet.</div>
        )}
        <div className="actions" style={{marginTop:12}}>
          <button className="btn primary" onClick={openNow} disabled={status==='open'}>Open Day</button>
        </div>
      </div>
    </section>
  )
}
