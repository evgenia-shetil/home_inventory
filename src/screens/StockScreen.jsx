import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { groupItems } from '../domain/groups.js'
import { shoppingGroups } from '../domain/needs.js'
import { estimateCost } from '../domain/cost.js'
import { searchItems, searchCategories } from '../domain/search.js'
import { expiringItems } from '../domain/expiry.js'
import { rootSummaries, unsortedItems, branchItems } from '../domain/home.js'
import { dueReplacements } from '../domain/plan.js'
import { localDate } from '../domain/expiry.js'
import { formatPrice } from '../lib/format.js'
import { plural } from '../lib/plural.js'
import ItemCard from '../ui/ItemCard.jsx'
import Qty from '../ui/Qty.jsx'
import { Skeleton, Empty, ErrorState } from '../ui/States.jsx'
import ScanIcon from '../ui/ScanIcon.jsx'
import { IconPlus, IconChevron } from '../ui/icons.jsx'

// Головна — не перелік усього, а вхід: зверху те, що треба купити,
// нижче плитки головних категорій. Відомість потреб відкривається
// всередині категорії — так на першому екрані немає довгої прокрутки,
// а питання «чи треба щось купити» має відповідь без жодного дотику.
export default function StockScreen() {
  const { items, categories, status, error, reload, consume, replace, notify } = useInventory()
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
  const foundCats = query.trim() ? searchCategories(categories, query) : []
  const parentName = c => categories.find(p => p.id === c.parent_id)?.name

  const needs = shoppingGroups(groupItems(items, categories))
  const cost = estimateCost(needs)
  const tiles = rootSummaries(items, categories)
  const unsorted = unsortedItems(items, categories)

  const today = localDate()
  const due = dueReplacements(categories.filter(c => c.parent_id), today)

  const expiring = expiringItems(items)
  const expiredCount = expiring.filter(x => x.expiry.state === 'expired').length
  const soonCount = expiring.length - expiredCount

  return (
    <>
      <div className="search">
        <input
          type="search"
          value={query}
          placeholder="Пошук товару чи категорії…"
          aria-label="Пошук товару чи категорії"
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
            {found.length + foundCats.length} {plural(found.length + foundCats.length, 'збіг', 'збіги', 'збігів')}
          </p>

          {/* Спершу потреби: шукаючи «паста», шукають зубну пасту взагалі,
              а марка може бути названа без цього слова. */}
          {foundCats.length > 0 && (
            <ul className="groups search__cats">
              {foundCats.map(c => {
                const inside = c.parent_id
                  ? items.filter(i => i.category_id === c.id)
                  : branchItems(c.id, items, categories)
                const [g] = c.parent_id ? groupItems(inside, categories) : []
                return (
                  <li key={c.id}>
                    <Link to={`/category/${c.id}`} className="group">
                      <span className="group__name">
                        {c.name}
                        <small className="group__sub">
                          {c.parent_id ? `у «${parentName(c)}»` : 'категорія'}
                        </small>
                      </span>
                      <span className="group__meta">
                        {g
                          ? <Qty value={g.total} unit={g.unit} />
                          : <span className="group__count">
                              {inside.length} {plural(inside.length, 'товар', 'товари', 'товарів')}
                            </span>}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          {found.length > 0 && (
            <div className="grid">
              {found.map(item => (
                <ItemCard key={item.id} item={item} low={false} onConsume={consume} />
              ))}
            </div>
          )}

          {found.length + foundCats.length === 0 && <Empty title="Нічого не знайдено" />}
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

          {/* Заміна за графіком — не нестача й не псування, а дата. Окремий
              рядок із дією просто в ньому: заходити в категорію заради
              одного дотику зайве. */}
          {due.map(({ category, due: date }) => (
            <div key={category.id} className="replacerow">
              <Link to={`/category/${category.id}`} className="replacerow__text">
                <b>Заміна: {category.name}</b>
                <span>{dueText(date, today)}</span>
              </Link>
              <button type="button" className="ghost"
                      onClick={() => replace(category.id, today).catch(err => notify(err.message, { tone: 'error' }))}>
                Замінено
              </button>
            </div>
          ))}

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

function dueText(date, today) {
  if (date < today) return 'час минув'
  if (date === today) return 'сьогодні'
  const days = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000)
  return days === 1 ? 'завтра' : `через ${days} ${plural(days, 'день', 'дні', 'днів')}`
}
