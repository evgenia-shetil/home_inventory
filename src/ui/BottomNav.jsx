import { NavLink } from 'react-router-dom'

export default function BottomNav() {
  return (
    <nav className="bottomnav">
      <NavLink to="/" end className={({ isActive }) => isActive ? 'on' : ''}>Запаси</NavLink>
      <NavLink to="/shopping" className={({ isActive }) => isActive ? 'on' : ''}>Покупки</NavLink>
      <NavLink to="/settings" className={({ isActive }) => isActive ? 'on' : ''}>Ще</NavLink>
    </nav>
  )
}
