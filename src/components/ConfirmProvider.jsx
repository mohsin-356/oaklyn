import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }){
  const [state, setState] = useState({ open: false, type: 'confirm', opts: {}, resolve: null })

  const openModal = useCallback((type, opts) => new Promise((resolve) => {
    setState({ open: true, type, opts: opts || {}, resolve })
  }), [])

  const confirm = useCallback((opts) => openModal('confirm', opts), [openModal])
  const alert = useCallback((opts) => openModal('alert', opts), [openModal])
  const prompt = useCallback((opts) => openModal('prompt', opts), [openModal])

  const onClose = useCallback((result) => {
    setState((s) => {
      s.resolve?.(result)
      return { open: false, type: 'confirm', opts: {}, resolve: null }
    })
  }, [])

  const value = useMemo(() => ({ confirm, alert, prompt }), [confirm, alert, prompt])

  const { title, description, confirmText = 'OK', cancelText = 'Cancel', inputLabel = 'Value', placeholder = '', defaultValue = '' } = state.opts || {}

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {state.open && (
        <div role="dialog" aria-modal="true" className="modal-overlay" onClick={() => onClose(state.type === 'confirm' ? false : undefined)}>
          <div style={dialogStyle} className="modal" onClick={(e) => e.stopPropagation()}>
            {title && <div className="card-title">{title}</div>}
            {description && <div className="muted" style={{ marginTop: 6 }}>{description}</div>}

            {state.type === 'prompt' && (
              <div className="form" style={{ marginTop: 12 }}>
                {inputLabel && <label>{inputLabel}</label>}
                <input
                  autoFocus
                  className="input"
                  placeholder={placeholder}
                  defaultValue={defaultValue}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = e.currentTarget.value
                      onClose(val)
                    }
                  }}
                />
              </div>
            )}

            <div className="actions" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              {state.type === 'confirm' && (
                <>
                  <button className="btn" onClick={() => onClose(false)}>{cancelText || 'Cancel'}</button>
                  <button className="btn danger" onClick={() => onClose(true)}>{confirmText || 'Confirm'}</button>
                </>
              )}
              {state.type === 'alert' && (
                <button className="btn primary" onClick={() => onClose(true)}>{confirmText || 'OK'}</button>
              )}
              {state.type === 'prompt' && (
                <>
                  <button className="btn" onClick={() => onClose(null)}>{cancelText || 'Cancel'}</button>
                  <button
                    className="btn primary"
                    onClick={(e) => {
                      const input = e.currentTarget.closest('.card')?.querySelector('input')
                      onClose(input ? input.value : '')
                    }}
                  >{confirmText || 'OK'}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(){
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx.confirm
}

export function useDialog(){
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useDialog must be used within ConfirmProvider')
  return ctx
}

// Backdrop style moved to CSS classes
const dialogStyle = {
  width: 'min(480px, 92vw)',
  boxShadow: '0 10px 30px rgba(0,0,0,0.25)'
}
