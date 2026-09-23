import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { groupItems } from '../domain/groups.js'
import { shoppingGroups, toBuy } from '../domain/needs.js'
import { estimateCost } from '../domain/cost.js'
import { formatQty, formatPrice } from '../lib/format.js'
import { plural } from '../lib/plural.js'
import { Skeleton, Empty, ErrorState } from '../ui/States.jsx'

export default function ShoppingScreen() {
  const { items, categories, status, error, reload, adjust, notify } = useInventory()
  const [busyId, setBusyId] = useState(null)

  if (status === 'loading') return <Skeleton count={3} />
  if (status === 'error') return <ErrorState message={error} onRetry={reload} />

  // Список покупок — перелік потреб, а не марок: у магазин ідеш
  // по зубну щітку, а не саме по Colgate.
  const low = shoppingGroups(groupItems(items, categories))

  if (low.length === 0) {
    return <Empty title="Усе на місці — купувати нічого" />
  }

  const cost = estimateCost(low)

  async function buy(itemId) {
    setBusyId(itemId)
    try {
      await adjust(itemId, 1, 'restock')
    } catch (err) {
      notify(err.message, { tone: 'error' })
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

      {cost.known > 0 && (
        <details className="info">
          <summary>Звідки ця сума</summary>
          <p>
            Береться найдешевша з відомих цін у кожній потребі, по одній штуці.
            Ціни зберігаються з останньої покупки, тож у магазині вони можуть
            відрізнятись. Це орієнтир, а не рахунок.
          </p>
        </details>
      )}

      <ul className="shopping">
        {low.map(group => (
          <li key={group.key}>
            {/* Повтор виникає лише в товару БЕЗ категорії: там назва групи
                і назва товару — буквально одне й те саме. Якщо ж група є
                категорією, вона каже чого бракує, а товар — якої марки. */}
            {group.categoryId && <p className="shopping__name">{group.name}</p>}
            <p className="muted">
              лишилось {formatQty(group.total, group.unit)}
              {group.inUse > 0 && ` (${formatQty(group.inUse, group.unit)} у користуванні)`}
              {toBuy(group) !== null
                ? ` · взяти ${formatQty(toBuy(group), group.unit)}`
                : `, поріг ${formatQty(group.threshold, group.unit)}`}
            </p>

            <ul className="shopping__brands">
              {group.items.map(item => (
                <li key={item.id}>
                  <Link to={`/item/${item.id}`} className="brand">
                    <span className="brand__name">{item.name}</span>
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
