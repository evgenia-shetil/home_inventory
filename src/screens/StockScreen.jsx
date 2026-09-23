import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { groupItems } from '../domain/groups.js'
import { formatQty } from '../lib/format.js'
import { plural } from '../lib/plural.js'
import CategoryStrip from '../ui/CategoryStrip.jsx'
import { Skeleton, Empty, ErrorState } from '../ui/States.jsx'
import ScanIcon from '../ui/ScanIcon.jsx'

export default function StockScreen() {
  const { items, categories, status, error, reload } = useInventory()
  const [root, setRoot] = useState(null)

  if (status === 'loading') return <Skeleton count={5} />
  if (status === 'error') return <ErrorState message={error} onRetry={reload} />

  if (items.length === 0) {
    return (
      <Empty
        title="Поки що порожньо"
        action={<>
          <Link to="/scan"><button>Сканувати штрихкод</button></Link>
          <Link to="/add"><button className="ghost">Додати вручну</button></Link>
        </>}
      />
    )
  }

  const roots = categories.filter(c => !c.parent_id)
  const children = categories.filter(c => c.parent_id === root)

  const inBranch = item => {
    if (!root) return true
    return item.category_id === root || children.some(c => c.id === item.category_id)
  }

  // Головний екран показує потреби, а не марки: рядок — це підкатегорія
  // з підсумковою кількістю. Марки всередині відкриваються окремо.
  const groups = groupItems(items.filter(inBranch), categories)

  return (
    <>
      <CategoryStrip categories={roots} selected={root} onSelect={setRoot} />

      <ul className="groups">
        {groups.map(group => (
          <li key={group.key}>
            <Link
              to={group.categoryId ? `/category/${group.categoryId}` : `/item/${group.items[0].id}`}
              className={`group${group.low ? ' group--low' : ''}`}
            >
              <span className="group__name">{group.name}</span>
              <span className="group__meta">
                <b>{formatQty(group.total, group.unit)}</b>
                {group.categoryId && group.items.length > 1 && (
                  <span className="muted"> · {group.items.length} {plural(group.items.length, 'марка', 'марки', 'марок')}</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="fabs">
        <Link to="/add" className="fab fab--small" aria-label="Додати товар вручну">+</Link>
        <Link to="/scan" className="fab" aria-label="Сканувати штрихкод"><ScanIcon /></Link>
      </div>
    </>
  )
}
