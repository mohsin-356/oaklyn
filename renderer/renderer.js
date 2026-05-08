function show(hash){
  const section = (hash||'').replace('#','') || 'activate'
  document.getElementById('activate').classList.toggle('hidden', section!=='activate')
  document.getElementById('dashboard').classList.toggle('hidden', section!=='dashboard')
}

window.addEventListener('hashchange', ()=> show(location.hash))
show(location.hash)

const licenseInput = document.getElementById('license')
const activateBtn = document.getElementById('activateBtn')
const quitBtn = document.getElementById('quitBtn')
const statusEl = document.getElementById('status')
const machineIdEl = document.getElementById('machineId')
const copyMidBtn = document.getElementById('copyMid')

if (activateBtn) {
  activateBtn.addEventListener('click', async ()=>{
    statusEl.textContent = 'Verifying license...'
    const key = licenseInput.value.trim()
    const ok = await window.burgerPos.activate(key)
    if (ok) {
      statusEl.textContent = 'Activation successful. Loading dashboard...'
      statusEl.classList.remove('error')
      window.location.hash = 'dashboard'
    } else {
      statusEl.textContent = 'Invalid or expired license. Please check and try again.'
      statusEl.classList.add('error')
    }
  })
}

if (quitBtn) {
  quitBtn.addEventListener('click', ()=> window.close())
}

// Load and show machine ID
if (machineIdEl) {
  window.burgerPos.getMachineId().then(id => {
    machineIdEl.textContent = id
  }).catch(()=>{
    machineIdEl.textContent = 'Unavailable'
  })
}

if (copyMidBtn) {
  copyMidBtn.addEventListener('click', async ()=>{
    try {
      const txt = machineIdEl?.textContent || ''
      await navigator.clipboard.writeText(txt)
      statusEl.textContent = 'Machine ID copied to clipboard.'
      statusEl.classList.remove('error')
    } catch {
      statusEl.textContent = 'Failed to copy Machine ID.'
      statusEl.classList.add('error')
    }
  })
}
