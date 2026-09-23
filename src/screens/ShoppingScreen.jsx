import { Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { isLow, sortByUrgency } from '../domain/sorting.js'
import { formatQty, formatPrice } from '../lib/format.js'
import { Skeleton, Empty, ErrorState } from '../ui/States.jsx'

export default function ShoppingScreen() {
  const { items, status, error, reload } = useInventory()

  if (status === 'loading') return <Skeleton count={3} />
  if (status === 'error') return <ErrorState message={error} onRetry={reload} />

  const low = sortByUrgency(items.filter(isLow))

  if (low.length === 0) {
    return <Empty title="Усе на місці — купувати нічого" />
  }

  return (
    <>
      <h1>Купити</h1>
      <ul className="shopping">
        {low.map(item => (
          <li key={item.id}>
            <div>
              <p className="shopping__name">{item.name}</p>
              <p className="muted">
                лишилось {formatQty(item.qty, item.unit)} · {formatPrice(item.last_price)}
                {item.last_place ? ` · ${item.last_place}` : ''}
              </p>
            </div>
            <Link to={`/item/${item.id}`}>
              <button className="ghost">Купила</button>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
