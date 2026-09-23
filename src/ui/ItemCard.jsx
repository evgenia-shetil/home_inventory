import { Link } from 'react-router-dom'
import { usePhotoUrl } from '../lib/photos.js'
import { formatQty } from '../lib/format.js'
import { isLow } from '../domain/sorting.js'

export default function ItemCard({ item, onConsume }) {
  const url = usePhotoUrl(item.photo_path)

  return (
    <article className={`card${isLow(item) ? ' card--low' : ''}`}>
      <Link to={`/item/${item.id}`} className="card__link">
        {url
          ? <img src={url} alt="" className="card__photo" loading="lazy" />
          : <div className="card__photo card__photo--empty" aria-hidden="true" />}
        <h2 className="card__name">{item.name}</h2>
        <p className="card__qty">{formatQty(item.qty, item.unit)}</p>
      </Link>
      <button
        className="card__consume"
        onClick={() => onConsume(item.id)}
        disabled={item.qty <= 0}
        aria-label={`Витратити одну одиницю: ${item.name}`}
      >
        −1
      </button>
    </article>
  )
}
