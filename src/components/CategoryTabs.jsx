import { NavLink } from 'react-router-dom'

export default function CategoryTabs(){
  const tabs = [
    { to: '/food', label: 'Food' },
    { to: '/deals', label: 'Deals' },
    { to: '/drinks', label: 'Drinks' },
    { to: '/extras', label: 'Extras' },
  ]
  return (
    <div className="tabs" role="tablist" aria-label="Categories">
      {tabs.map(t => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}
        >
          {t.label}
        </NavLink>
      ))}
    </div>
  )
}
