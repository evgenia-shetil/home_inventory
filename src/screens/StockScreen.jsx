import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { groupItems } from '../domain/groups.js'
import { searchItems } from '../domain/search.js'
import { expiringItems } from '../domain/expiry.js'
import { formatQty } from '../lib/format.js'
import ItemCard from '../ui/ItemCard.jsx'
import Qty from '../ui/Qty.jsx'
import { plural } from '../lib/plural.js'
import CategoryStrip from '../ui/CategoryStrip.jsx'
import { Skeleton, Empty, ErrorState } from '../ui/States.jsx'
import ScanIcon from '../ui/ScanIcon.jsx'
import { IconPlus } from '../ui/icons.jsx'

const UNSORTED = '__unsorted__'

export default function StockScreen() {
  const { items, categories, status, error, reload, adjust, notify } = useInventory()
  const [root, setRoot] = useState(null)
  const [query, setQuery] = useState('')

  if (status === 'loading') return <Skeleton count={5} />
  if (status === 'error') return <ErrorState message={error} onRetry={reload} />

  if (items.length === 0) {
    return (
      <Empty
        title="Запасів немає"
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

  // Спершу закінчується те, що вже відкрите, і лише потім береться запас.
  const consumeOne = id => {
    const target = items.find(i => i.id === id)
    const bucket = Number(target?.in_use ?? 0) > 0 ? 'in_use' : 'stock'
    return adjust(id, -1, 'consume', { bucket })
      .catch(err => notify(err.message, { tone: 'error' }))
  }


  const roots = categories.filter(c => !c.parent_id)

  // Нерозкладене: товар або взагалі без категорії, або причеплений
  // до головної, але без підкатегорії.
  const unsorted = items.filter(item => {
    if (!item.category_id) return true
    const c = categories.find(x => x.id === item.category_id)
    return Boolean(c) && !c.parent_id
  })
  const children = categories.filter(c => c.parent_id === root)

  const inBranch = item => {
    if (!root) return true
    return item.category_id === root || children.some(c => c.id === item.category_id)
  }

  // Головний екран показує потреби, а не марки: рядок — це підкатегорія
  // з підсумковою кількістю. Марки всередині відкриваються окремо.
  const groups = groupItems(items.filter(inBranch), categories)

  const expiring = expiringItems(items)
  const expiredCount = expiring.filter(x => x.expiry.state === 'expired').length
  const soonCount = expiring.length - expiredCount

  return (
    <>
      <div className="search">
        <input
          type="search"
          value={query}
          placeholder="Пошук"
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
                  onConsume={id => consumeOne(id)}
                />
              ))}
            </div>
          : <Empty title="Нічого не знайдено" />
      )}


      {!found && expiring.length > 0 && (
        <Link to="/expiring" className="expiryrow">
          <span>Термін придатності</span>
          <span>
            {expiredCount > 0 && <b>{expiredCount} {plural(expiredCount, 'прострочений', 'прострочені', 'прострочених')}</b>}
            {expiredCount > 0 && soonCount > 0 && ', '}
            {soonCount > 0 && `${soonCount} скоро`}
          </span>
        </Link>
      )}

      {!found && (
        <CategoryStrip
          categories={roots}
          selected={root}
          onSelect={setRoot}
          extra={unsorted.length > 0
            ? { id: UNSORTED, name: `без підкатегорії · ${unsorted.length}` }
            : null}
        />
      )}

      {!found && root === UNSORTED && (
        unsorted.length > 0
          ? <>
              <p className="muted">
                Товари без категорії або без підкатегорії. Категорія
                змінюється в картці товару.
              </p>
              <div className="grid">
                {unsorted.map(item => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    low={false}
                    onConsume={id => consumeOne(id)}
                  />
                ))}
              </div>
            </>
          : <Empty title="Усе розкладено" />
      )}

      {!found && root !== UNSORTED && <ul className="groups">
        {groups.map(group => (
          <li key={group.key}>
            <Link
              to={group.categoryId ? `/category/${group.categoryId}` : `/item/${group.items[0].id}`}
              className={`group${group.low ? ' group--low' : ''}`}
            >
              <span className="group__name">{group.name}</span>
              <span className="group__meta">
                {group.expired > 0 && <span className="group__flag">прострочено</span>}
                {group.mixedUnits
                  ? <span className="qty">{group.byUnit.map(u => formatQty(u.total, u.unit)).join(' + ')}</span>
                  : <Qty value={group.total} unit={group.unit} />}
                {group.categoryId && group.items.length > 1 && (
                  <span className="group__count">
                    {group.items.length} {plural(group.items.length, 'товар', 'товари', 'товарів')}
                  </span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>}

      <div className="fabs">
        <Link to="/add" className="fab fab--small" aria-label="Додати товар вручну"><IconPlus /></Link>
        <Link to="/scan" className="fab" aria-label="Сканувати штрихкод"><ScanIcon /></Link>
      </div>
    </>
  )
}
