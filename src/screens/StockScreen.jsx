import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { groupItems } from '../domain/groups.js'
import { shoppingGroups } from '../domain/needs.js'
import { estimateCost } from '../domain/cost.js'
import { searchItems } from '../domain/search.js'
import { expiringItems } from '../domain/expiry.js'
import { rootSummaries, unsortedItems } from '../domain/home.js'
import { formatPrice } from '../lib/format.js'
import { plural } from '../lib/plural.js'
import ItemCard from '../ui/ItemCard.jsx'
import { Skeleton, Empty, ErrorState } from '../ui/States.jsx'
import ScanIcon from '../ui/ScanIcon.jsx'
import { IconPlus, IconChevron } from '../ui/icons.jsx'

// Головна — не перелік усього, а вхід: зверху те, що треба купити,
// нижче плитки головних категорій. Відомість потреб відкривається
// всередині категорії — так на першому екрані немає довгої прокрутки,
// а питання «чи треба щось купити» має відповідь без жодного дотику.
export default function StockScreen() {
  const { items, categories, status, error, reload, consume } = useInventory()
  const [query, setQuery] = useState('')

  if (status === 'loading') return <Skeleton variant="home" />
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

  // Під час пошуку плитки недоречні: шукають конкретну річ,
  // тож показуємо плаский список збігів.
  const found = query.trim() ? searchItems(items, query) : null

  const needs = shoppingGroups(groupItems(items, categories))
  const cost = estimateCost(needs)
  const tiles = rootSummaries(items, categories)
  const unsorted = unsortedItems(items, categories)

  const expiring = expiringItems(items)
  const expiredCount = expiring.filter(x => x.expiry.state === 'expired').length
  const soonCount = expiring.length - expiredCount

  return (
    <>
      <div className="search">
        <input
          type="search"
          value={query}
          placeholder="Пошук товару…"
          aria-label="Пошук товару"
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" className="search__clear" onClick={() => setQuery('')}
                  aria-label="Очистити пошук">×</button>
        )}
      </div>

      {found && (
        <>
          <p className="muted" aria-live="polite">
            {found.length} {plural(found.length, 'збіг', 'збіги', 'збігів')}
          </p>
          {found.length
            ? <div className="grid">
                {found.map(item => (
                  <ItemCard key={item.id} item={item} low={false} onConsume={consume} />
                ))}
              </div>
            : <Empty title="Нічого не знайдено" />}
        </>
      )}

      {!found && (
        <>
          <Link to="/shopping" className={`buytile${needs.length ? '' : ' buytile--calm'}`}>
            {needs.length
              ? <>
                  <span className="buytile__num num">{needs.length}</span>
                  <span className="buytile__text">
                    <b>{plural(needs.length, 'потреба', 'потреби', 'потреб')} у покупках</b>
                    {cost.known > 0 && <span>орієнтовно {formatPrice(cost.total)}</span>}
                  </span>
                </>
              : <span className="buytile__text">
                  <b>Покупки</b>
                  <span>Потреб немає</span>
                </span>}
            <IconChevron />
          </Link>

          {expiring.length > 0 && (
            <Link to="/expiring" className="expiryrow">
              <span className="expiryrow__text">
                <b>Термін придатності</b>
                <span>
                  {[
                    expiredCount ? `${expiredCount} ${plural(expiredCount, 'прострочений', 'прострочені', 'прострочених')}` : null,
                    soonCount ? `${soonCount} ${plural(soonCount, 'спливає', 'спливають', 'спливають')} за місяць` : null,
                  ].filter(Boolean).join(', ')}
                </span>
              </span>
              <IconChevron />
            </Link>
          )}

          <nav className="tiles" aria-label="Категорії">
            {tiles.map(({ category, groups, needs: n, expired }) => (
              <Link
                key={category.id}
                to={`/category/${category.id}`}
                className={`tile${n ? ' tile--low' : ''}`}
              >
                <span className="tile__name">{category.name}</span>
                <span className="tile__meta">
                  {groups === 0
                    ? 'порожньо'
                    : `${groups} ${plural(groups, 'позиція', 'позиції', 'позицій')}`}
                </span>
                {(n > 0 || expired > 0) && (
                  <span className="tile__flags">
                    {n > 0 && <span>купити {n}</span>}
                    {expired > 0 && <span>прострочено {expired}</span>}
                  </span>
                )}
              </Link>
            ))}

            {/* Службова плитка: без неї нерозкладені товари губляться,
                і знайти їх можна лише перебором категорій. */}
            {unsorted.length > 0 && (
              <Link to="/unsorted" className="tile tile--extra">
                <span className="tile__name">Без категорії</span>
                <span className="tile__meta">
                  {unsorted.length} {plural(unsorted.length, 'товар', 'товари', 'товарів')}
                </span>
              </Link>
            )}
          </nav>
        </>
      )}

      <div className="fabs">
        <Link to="/add" className="fab fab--small" aria-label="Додати товар вручну"><IconPlus /></Link>
        <Link to="/scan" className="fab" aria-label="Сканувати штрихкод"><ScanIcon /></Link>
      </div>
    </>
  )
}
