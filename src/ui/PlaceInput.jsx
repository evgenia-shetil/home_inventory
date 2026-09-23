import { useState } from 'react'

const OTHER = '__other__'

// Випадайник магазинів. Список збирається з уже введених товарів,
// тож доданий один раз магазин сам з'являється в наступних.
export default function PlaceInput({ value, places, onChange }) {
  const known = places.includes(value)
  const [typing, setTyping] = useState(Boolean(value) && !known)

  if (typing) {
    return (
      <div className="placeinput">
        <input
          value={value}
          placeholder="Магазин"
          onChange={e => onChange(e.target.value)}
          autoFocus
        />
        <button type="button" className="link" onClick={() => { setTyping(false); onChange('') }}>
          Обрати зі списку
        </button>
      </div>
    )
  }

  return (
    <select
      value={known ? value : ''}
      onChange={e => {
        if (e.target.value === OTHER) {
          setTyping(true)
          onChange('')
        } else {
          onChange(e.target.value)
        }
      }}
    >
      <option value="">не вказано</option>
      {places.map(p => <option key={p} value={p}>{p}</option>)}
      <option value={OTHER}>+ інший магазин…</option>
    </select>
  )
}
