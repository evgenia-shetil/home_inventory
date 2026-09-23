import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { groupItems } from '../domain/groups.js'
import { estimateCost } from '../domain/cost.js'
import { formatQty, formatPrice } from '../lib/format.js'
import { plural } from '../lib/plural.js'
import { Skeleton, Empty, ErrorState } from '../ui/States.jsx'

export default function ShoppingScreen() {
  const { items, categories, status, error, reload, adjust } = useInventory()
  const [busyId, setBusyId] = useState(null)

  if (status === 'loading') return <Skeleton count={3} />
  if (status === 'error') return <ErrorState message={error} onRetry={reload} />

  // Список покупок — перелік потреб, а не марок: у магазин ідеш
  // по зубну щітку, а не саме по Colgate.
  const low = groupItems(items, categories).filter(g => g.low)

  if (low.length === 0) {
    return <Empty title="Усе на місці — купувати нічого" />
  }

  const cost = estimateCost(low)

  async function buy(itemId) {
    setBusyId(itemId)
    try {
      await adjust(itemId, 1, 'restock')
    } catch {
      // Помилку показує спільна плашка мережі; тут мовчимо навмисно.
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <h1>Купити</h1>
      <p className="muted">
        {low.length} {plural(low.length, 'потреба', 'потреби', 'потреб')}
        {cost.known > 0 && ` · орієнтовно ${formatPrice(cost.total)}, якщо взяти по одній`}
        {cost.unknown > 0 && ` (для ${cost.unknown} ціни ще немає)`}
      </p>

      <ul className="shopping">
        {low.map(group => (
          <li key={group.key}>
            {/* Одинокий товар без підкатегорії вже назвав себе в group.name:
                другий раз та сама назва в брендовому рядку нижче була б
                чистим повтором без нової інформації. */}
            {group.items.length > 1 && <p className="shopping__name">{group.name}</p>}
            <p className="muted">
              лишилось {formatQty(group.total, group.unit)}, поріг {formatQty(group.threshold, group.unit)}
            </p>

            <ul className="shopping__brands">
              {group.items.map(item => (
                <li key={item.id}>
                  <Link to={`/item/${item.id}`} className="brand">
                    <span className="brand__name">
                      {group.items.length > 1 ? item.name : group.name}
                    </span>
                    <span className="brand__meta">
                      {formatQty(item.qty, item.unit)}
                      {item.last_price !== null && ` · ${formatPrice(item.last_price)}`}
                      {item.last_place && ` · ${item.last_place}`}
                    </span>
                  </Link>
                  <button
                    className="brand__buy"
                    disabled={busyId === item.id}
                    onClick={() => buy(item.id)}
                    aria-label={`Купила одну: ${item.name}`}
                  >
                    купила
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </>
  )
}
