import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { groupItems } from '../domain/groups.js'
import { buildPlan } from '../domain/plan.js'
import { formatQty, formatPrice, formatNumber } from '../lib/format.js'
import { plural } from '../lib/plural.js'
import Qty from './Qty.jsx'

const PERIOD = { 3: 'на 3 місяці', 6: 'на пів року', 12: 'на рік' }

// План великої закупівлі: одна корзина на весь період. Запас на кінець
// періоду доходить до нуля — так вирішила користувачка.
export default function PlanView({ horizon, journal }) {
  const { items, categories, adjust, notify } = useInventory()
  const [busyId, setBusyId] = useState(null)

  const groups = groupItems(items, categories)
  const plan = buildPlan(groups, categories, { events: journal.events ?? [], horizon })

  async function buy(itemId, qty) {
    setBusyId(itemId)
    try {
      await adjust(itemId, qty, 'restock')
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
          <dt>Купити</dt>
          <dd className="num">{plan.rows.length}</dd>
        </div>
        {plan.priced > 0 && (
          <div>
            <dt>Орієнтовно</dt>
            <dd className="num">{formatPrice(plan.total)}</dd>
          </div>
        )}
        <div>
          <dt>Вистачає</dt>
          <dd className="num">{plan.covered}</dd>
        </div>
      </dl>

      <details className="info">
        <summary>Про розрахунок</summary>
        <p>
          Кількість розрахована так, щоб запасу вистачило {PERIOD[horizon]} і на
          кінець періоду він дійшов до нуля. Темп береться з норми підкатегорії,
          а без неї — з журналу витрат, коли той набере історію. Прострочене
          в запас не входить.
        </p>
        <p>
          Для речей, які міняються за графіком, рахується кількість замін у
          періоді. Те, що вже в користуванні, заміну не покриває.
        </p>
        <p>
          Сума — за найкращою відомою ціною. Ціни з минулих покупок могли
          змінитись, і для частини потреб їх немає, тож це орієнтир.
        </p>
      </details>

      {journal.error && <p className="muted">Журнал недоступний: {journal.error}</p>}

      {plan.rows.length === 0 && (
        <p className="empty--inline">
          {plan.unknown.length
            ? 'Для потреб із відомим темпом купувати нічого не треба.'
            : `Запасу вистачає ${PERIOD[horizon]}.`}
        </p>
      )}

      <ul className="shopping">
        {plan.rows.map(row => <PlanRow key={row.group.key} row={row} busyId={busyId} onBuy={buy} />)}
      </ul>

      {plan.unknown.length > 0 && (
        <section className="upcoming">
          <h2>Темп невідомий</h2>
          <p className="muted">
            Без норми й без історії в журналі не порахувати, скільки знадобиться.
          </p>
          <Link to="/norms" className="linkline">Задати норми</Link>
          <ul className="groups">
            {plan.unknown.map(({ group }) => (
              <li key={group.key}>
                <Link
                  to={group.categoryId ? `/category/${group.categoryId}` : `/item/${group.items[0].id}`}
                  className="group"
                >
                  <span className="group__name">{group.name}</span>
                  <span className="group__meta"><Qty value={group.total} unit={group.unit} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function PlanRow({ row, busyId, onBuy }) {
  const { group, offer } = row
  // План рахується в одиницях групи: марки в інших одиницях не враховані.
  const unit = group.unit
  const q = value => formatQty(value, unit)

  // Запропонована марка — та, що з найкращою ціною; решта нижче, бо
  // купити можна й іншу.
  const brands = group.items.filter(i => i.recurring !== false)
  const ordered = offer ? [offer.item, ...brands.filter(i => i.id !== offer.item.id)] : brands

  const basis = row.source === 'schedule'
    ? `${row.replacements} ${plural(row.replacements, 'заміна', 'заміни', 'замін')} за період`
    : row.source === 'journal' ? 'за журналом' : 'за нормою'

  return (
    <li>
      <div className="planrow">
        <p className="shopping__name">{group.name}</p>
        <Qty value={row.buy} unit={unit} className="planrow__qty" />
      </div>
      <p className="muted">
        {basis}: потрібно {q(Math.round(row.need * 100) / 100)}, є {q(row.have)}
        {row.cost !== null && `, орієнтовно ${formatPrice(row.cost)}`}
      </p>
      {row.warning === 'mixed' && (
        <p className="shopping__hint error">
          Марки в інших одиницях у запас не враховано. Їх можна перевести в упаковки в картці товару.
        </p>
      )}

      <ul className="shopping__brands">
        {ordered.map(item => (
          <li key={item.id}>
            <Link to={`/item/${item.id}`} className="brand">
              <span className="brand__name">{item.name}</span>
              <span className="brand__meta">
                {offer?.item.id === item.id && offer.place && <span>{offer.place}</span>}
                {offer?.item.id === item.id
                  ? <span className="num">{formatPrice(offer.price)}</span>
                  : item.last_price !== null && <span className="num">{formatPrice(item.last_price)}</span>}
              </span>
            </Link>
            <button
              className="brand__buy"
              disabled={busyId === item.id}
              onClick={() => onBuy(item.id, row.buy)}
              aria-label={`Позначити куплено ${row.buy}: ${item.name}`}
            >
              Куплено {formatNumber(row.buy)}
            </button>
          </li>
        ))}
      </ul>
    </li>
  )
}
