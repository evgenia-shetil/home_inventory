import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { groupItems } from '../domain/groups.js'
import { searchItems } from '../domain/search.js'
import ItemCard from '../ui/ItemCard.jsx'
import { formatQty } from '../lib/format.js'
import { plural } from '../lib/plural.js'
import CategoryStrip from '../ui/CategoryStrip.jsx'
import { Skeleton, Empty, ErrorState } from '../ui/States.jsx'
import ScanIcon from '../ui/ScanIcon.jsx'

export default function StockScreen() {
  const { items, categories, status, error, reload, adjust } = useInventory()
  const [root, setRoot] = useState(null)
  const [query, setQuery] = useState('')

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

  // Під час пошуку перелік потреб недоречний: шукають конкретну річ,
  // тож показуємо плаский список збігів.
  const found = query.trim() ? searchItems(items, query) : null

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
      <div className="search">
        <input
          type="search"
          value={query}
          placeholder="знайти товар"
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" className="search__clear" onClick={() => setQuery('')}
                  aria-label="Очистити пошук">×</button>
        )}
      </div>

      {found && (
        <p className="muted">
          {found.length} {plural(found.length, 'збіг', 'збіги', 'збігів')}
        </p>
      )}

      {found && (
        found.length
          ? <div className="grid">
              {found.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  low={false}
                  onConsume={id => adjust(id, -1, 'consume').catch(() => {})}
                />
              ))}
            </div>
          : <Empty title={`Нічого не знайшлось за «${query}»`} />
      )}

      {!found && <CategoryStrip categories={roots} selected={root} onSelect={setRoot} />}

      {!found && <ul className="groups">
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
                  <span className="muted"> · {group.items.length} {plural(group.items.length, 'товар', 'товари', 'товарів')}</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>}

      <div className="fabs">
        <Link to="/add" className="fab fab--small" aria-label="Додати товар вручну">+</Link>
        <Link to="/scan" className="fab" aria-label="Сканувати штрихкод"><ScanIcon /></Link>
      </div>
    </>
  )
}
