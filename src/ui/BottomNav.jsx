import { NavLink } from 'react-router-dom'
import { IconStock, IconCart, IconMore } from './icons.jsx'

const items = [
  { to: '/', end: true, label: 'Запаси', Icon: IconStock },
  { to: '/shopping', label: 'Покупки', Icon: IconCart },
  { to: '/settings', label: 'Ще', Icon: IconMore },
]

export default function BottomNav() {
  return (
    <nav className="bottomnav">
      {items.map(({ to, end, label, Icon }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'on' : ''}>
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
