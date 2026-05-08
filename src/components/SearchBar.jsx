import { useState, useEffect } from 'react'

export default function SearchBar({ placeholder = 'Search...', onChange }) {
  const [q, setQ] = useState('')

  useEffect(() => {
    const id = setTimeout(() => onChange?.(q), 200)
    return () => clearTimeout(id)
  }, [q, onChange])

  return (
    <input
      className="input"
      type="text"
      placeholder={placeholder}
      value={q}
      onChange={(e) => setQ(e.target.value)}
    />
  )
}
