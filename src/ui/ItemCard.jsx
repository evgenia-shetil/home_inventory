import { Link } from 'react-router-dom'
import { usePhotoUrl } from '../lib/photos.js'
import Qty from './Qty.jsx'

// Порожній сірий прямокутник займав пів картки й не повідомляв нічого.
// Літера з кольором, виведеним із назви, дає впізнаваність без фото.
function hue(name = '') {
  let sum = 0
  for (const ch of name) sum = (sum + ch.codePointAt(0) * 7) % 360
  return sum
}

export default function ItemCard({ item, low, onConsume }) {
  const inUse = Number(item.in_use ?? 0)
  const total = Number(item.qty) + inUse
  const url = usePhotoUrl(item.photo_path)

  return (
    <article className={`card${low ? ' card--low' : ''}`}>
      <Link to={`/item/${item.id}`} className="card__link">
        {url
          ? <img src={url} alt="" className="card__photo" loading="lazy" />
          : <div
              className="card__photo card__photo--letter"
              style={{ '--tint': `hsl(${hue(item.name)} 45% 80%)` }}
              aria-hidden="true"
            >
              {(item.name ?? '?').trim().charAt(0).toUpperCase()}
            </div>}
        <h2 className="card__name">{item.name}</h2>
        <p className="card__qty"><Qty value={total} unit={item.unit} /></p>
        {inUse > 0 && <p className="card__use">{inUse} у користуванні</p>}
      </Link>
      <button
        className="card__consume"
        onClick={() => onConsume(item.id)}
        disabled={total <= 0}
        aria-label={`Витратити одну одиницю: ${item.name}`}
      >
        −1
      </button>
    </article>
  )
}
