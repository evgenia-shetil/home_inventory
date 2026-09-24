import { Link } from 'react-router-dom'
import { usePhotoUrl } from '../lib/photos.js'
import Qty from './Qty.jsx'
import { hue } from '../lib/hue.js'
import { expiryState } from '../domain/expiry.js'
import { formatQty } from '../lib/format.js'

export default function ItemCard({ item, low, onConsume }) {
  const inUse = Number(item.in_use ?? 0)
  const total = Number(item.qty) + inUse
  const url = usePhotoUrl(item.photo_path)
  const expiry = expiryState(item)

  return (
    <article className={`card${low ? ' card--low' : ''}`}>
      <Link to={`/item/${item.id}`} className="card__link">
        {url
          ? <img src={url} alt="" className="card__photo" loading="lazy" width="104" height="104" />
          : <div
              className="card__photo card__photo--letter"
              style={{ '--hue': hue(item.name) }}
              aria-hidden="true"
            >
              {(item.name ?? '?').trim().charAt(0).toUpperCase()}
            </div>}
        <h2 className="card__name">{item.name}</h2>
        {item.pack_size && <p className="card__use">по {formatQty(item.pack_size, item.pack_unit)}</p>}
        <p className="card__qty"><Qty value={total} unit={item.unit} /></p>
        {inUse > 0 && <p className="card__use">{inUse} у користуванні</p>}
        {expiry?.state === 'expired' && <p className="card__expiry">прострочено</p>}
        {expiry?.state === 'soon' && <p className="card__use">термін спливає</p>}
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
