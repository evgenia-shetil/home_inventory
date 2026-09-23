import { Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { groupItems } from '../domain/groups.js'
import { formatQty } from '../lib/format.js'
import { Skeleton, Empty, ErrorState } from '../ui/States.jsx'

export default function ShoppingScreen() {
  const { items, categories, status, error, reload } = useInventory()

  if (status === 'loading') return <Skeleton count={3} />
  if (status === 'error') return <ErrorState message={error} onRetry={reload} />

  // Список покупок — це перелік потреб, а не марок: у магазин ідеш
  // по зубну щітку, а не саме по Colgate.
  const low = groupItems(items, categories).filter(g => g.low)

  if (low.length === 0) {
    return <Empty title="Усе на місці — купувати нічого" />
  }

  return (
    <>
      <h1>Купити</h1>
      <ul className="shopping">
        {low.map(group => (
          <li key={group.key} className="shopping__group">
            <p className="shopping__name">{group.name}</p>
            <p className="muted">
              лишилось {formatQty(group.total, group.unit)}, поріг {formatQty(group.threshold, group.unit)}
            </p>
            <ul className="shopping__brands">
              {group.items.map(item => (
                <li key={item.id}>
                  <Link to={`/item/${item.id}`}>
                    {item.name} — {formatQty(item.qty, item.unit)}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </>
  )
}
