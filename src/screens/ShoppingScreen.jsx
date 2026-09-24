import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { groupItems } from '../domain/groups.js'
import { shoppingGroups, toBuy } from '../domain/needs.js'
import { estimateCost } from '../domain/cost.js'
import { bestOffer } from '../domain/prices.js'
import { useJournal } from '../lib/journal.js'
import { upcoming, formatDuration } from '../domain/forecast.js'
import { formatQty, formatPrice, formatNumber } from '../lib/format.js'
import { Skeleton, ErrorState } from '../ui/States.jsx'
import PlanView from '../ui/PlanView.jsx'

const HORIZON_KEY = 'zapasy:horizon'
const MODES = [
  { value: 'now', label: 'Зараз' },
  { value: '3', label: '3 міс' },
  { value: '6', label: 'Пів року' },
  { value: '12', label: 'Рік' },
]

// Вибір періоду — зручність цього пристрою, тож живе в браузері.
function readMode() {
  try {
    const saved = localStorage.getItem(HORIZON_KEY)
    return MODES.some(m => m.value === saved) ? saved : 'now'
  } catch {
    return 'now'
  }
}

// «Зараз» — те, що вже нижче сигналу. Решта — план великої закупівлі:
// скільки взяти одразу, щоб вистачило на весь період.
export default function ShoppingScreen() {
  const { status, error, reload } = useInventory()
  const [mode, setMode] = useState(readMode)
  const journal = useJournal()

  if (status === 'loading') return <Skeleton count={3} />
  if (status === 'error') return <ErrorState message={error} onRetry={reload} />

  const choose = value => {
    setMode(value)
    try { localStorage.setItem(HORIZON_KEY, value) } catch { /* лише зручність */ }
  }

  return (
    <>
      <h1>Покупки</h1>
      <div className="segmented" role="tablist" aria-label="Період закупівлі">
        {MODES.map(m => (
          <button
            key={m.value} type="button" role="tab"
            aria-selected={mode === m.value}
            className={mode === m.value ? 'on' : ''}
            onClick={() => choose(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode === 'now'
        ? <NowList journal={journal} />
        : <PlanView horizon={Number(mode)} journal={journal} />}
    </>
  )
}

function NowList({ journal }) {
  const { items, categories, adjust, notify } = useInventory()
  const [busyId, setBusyId] = useState(null)

  // Список покупок — перелік потреб, а не марок: у магазин ідеш
  // по зубну щітку, а не саме по Colgate.
  const groups = groupItems(items, categories)
  const low = shoppingGroups(groups)
  const soon = journal.events ? upcoming(groups, journal.events, new Date(), undefined, categories) : []

  if (low.length === 0) {
    return (
      <>
        <p className="empty--inline">Нижче сигналу нічого немає.</p>
        <Upcoming list={soon} />
      </>
    )
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
      <dl className="summary">
        <div>
          <dt>Потреб</dt>
          <dd className="num">{low.length}</dd>
        </div>
        {cost.known > 0 && (
          <div>
            <dt>Орієнтовно</dt>
            <dd className="num">{formatPrice(cost.total)}</dd>
          </div>
        )}
        {cost.unknown > 0 && (
          <div>
            <dt>Без ціни</dt>
            <dd className="num">{cost.unknown}</dd>
          </div>
        )}
      </dl>

      {cost.known > 0 && (
        <details className="info">
          <summary>Про розрахунок</summary>
          <p>
            Береться найдешевша з відомих цін у кожній потребі, по одній одиниці.
            Ціни збережені з останньої покупки і могли змінитись. Це орієнтир,
            а не рахунок.
          </p>
        </details>
      )}

      {journal.error && (
        <p className="muted">Порівняння цін недоступне: {journal.error}</p>
      )}

      <ul className="shopping">
        {low.map(group => (
          <li key={group.key}>
            {/* Повтор виникає лише в товару БЕЗ категорії: там назва групи
                і назва товару — буквально одне й те саме. Якщо ж група є
                категорією, вона каже чого бракує, а товар — якої марки. */}
            {group.categoryId && <p className="shopping__name">{group.name}</p>}
            <p className="muted">{describeNeed(group)}</p>

            <OfferHint group={group} events={journal.events} />

            <ul className="shopping__brands">
              {group.items.map(item => (
                <li key={item.id}>
                  <Link to={`/item/${item.id}`} className="brand">
                    <span className="brand__name">{item.name}</span>
                    <span className="brand__meta">
                      <b className="num">{formatQty(item.qty, item.unit)}</b>
                      {item.last_price !== null && (
                        <span className="num">{formatPrice(item.last_price)}</span>
                      )}
                      {item.last_place && <span>{item.last_place}</span>}
                    </span>
                  </Link>
                  <button
                    className="brand__buy"
                    disabled={busyId === item.id}
                    onClick={() => buy(item.id)}
                    aria-label={`Позначити куплено: ${item.name}`}
                  >
                    Куплено
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <Upcoming list={soon} />
    </>
  )
}

// Прогноз окремо від списку: це ще не потреба, а попередження.
// Змішати їх означало б купувати те, що ще є вдома.
function Upcoming({ list }) {
  if (!list.length) return null
  return (
    <section className="upcoming">
      <h2>Скоро закінчиться</h2>
      <p className="muted">За темпом витрачання з журналу. Це оцінка.</p>
      <ul className="groups">
        {list.map(({ group, forecast }) => (
          <li key={group.key}>
            <Link
              to={group.categoryId ? `/category/${group.categoryId}` : `/item/${group.items[0].id}`}
              className="group"
            >
              <span className="group__name">{group.name}</span>
              <span className="group__meta">
                {forecast.daysToSignal < 1
                  ? 'сигнал найближчим часом'
                  : `сигнал через ${formatDuration(forecast.daysToSignal)}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Підказка «де брати» має сенс лише тоді, коли було з чим порівнювати:
// єдина відома ціна вже стоїть у рядку марки.
function OfferHint({ group, events }) {
  if (!events) return null
  const offer = bestOffer(group, events)
  if (!offer || offer.alternatives === 0) return null

  // Марку називаємо, лише коли їх кілька; магазин — коли він відомий.
  const what = [
    group.items.length > 1 ? offer.item.name : null,
    offer.place,
  ].filter(Boolean).join(', ')
  if (!what) return null

  return (
    <p className="shopping__hint">
      Вигідніше: {what}, {formatPrice(offer.price)}
      {offer.byVolume && ` (${formatPrice(offer.perUnit * 100)} за 100 ${offer.item.pack_unit})`}
    </p>
  )
}

// Зі змішаними одиницями одиниця групи — лише одиниця першої марки,
// тож частини суми підписуються без неї, щоб не писати «1 мл» про штуку.
function describeNeed(group) {
  const q = value => (group.mixedUnits ? formatNumber(value) : formatQty(value, group.unit))
  const buy = toBuy(group)
  return [
    `лишилось ${q(group.usable)}`,
    group.inUse > 0 ? `з них ${q(group.inUse)} у користуванні` : null,
    group.expired > 0 ? `ще ${q(group.expired)} прострочено` : null,
    buy !== null ? `взяти ${q(buy)}` : `сигнал на ${q(group.threshold)}`,
  ].filter(Boolean).join(', ')
}
