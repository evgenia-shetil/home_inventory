import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { groupItems } from '../domain/groups.js'
import { parseQty } from '../domain/quantity.js'
import { consumptionRate, MONTH_DAYS } from '../domain/forecast.js'
import { localDate } from '../domain/expiry.js'
import { useJournal } from '../lib/journal.js'
import { formatNumber } from '../lib/format.js'
import { plural } from '../lib/plural.js'
import { Skeleton, ErrorState } from '../ui/States.jsx'

// Усі норми на одному екрані. План закупівлі без норм майже порожній, а
// задавати їх по одній через ⋯ у кожній підкатегорії — десятки переходів.
export default function NormsScreen() {
  const navigate = useNavigate()
  const { items, categories, status, error, reload } = useInventory()
  const journal = useJournal()
  const [onlyMissing, setOnlyMissing] = useState(false)

  if (status === 'loading') return <Skeleton count={4} />
  if (status === 'error') return <ErrorState message={error} onRetry={reload} />

  const subs = categories.filter(c => c.parent_id)
  const hasNorm = c => Number(c.usage_qty) > 0 && Number(c.usage_months) > 0
  const missing = subs.filter(c => !hasNorm(c)).length
  const roots = categories.filter(c => !c.parent_id)

  return (
    <div className="stack">
      <button className="back" onClick={() => navigate(-1)}>← назад</button>
      <h1>Норми</h1>
      <p className="muted">
        Скільки витрачається за період. З норм рахується план закупівлі на 3
        місяці, пів року чи рік. Без норми темп береться з журналу, коли той
        набере історію.
      </p>

      <label className="switch">
        <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} />
        <span>
          Лише без норми
          <small className="muted">
            {missing
              ? `${missing} ${plural(missing, 'підкатегорія', 'підкатегорії', 'підкатегорій')} без норми`
              : 'Норми задано для всіх'}
          </small>
        </span>
      </label>

      {roots.map(root => {
        const children = subs
          .filter(c => c.parent_id === root.id)
          .filter(c => !onlyMissing || !hasNorm(c))
          .sort((a, b) => a.name.localeCompare(b.name, 'uk'))
        if (!children.length) return null
        return (
          <section key={root.id}>
            <h2>{root.name}</h2>
            <ul className="norms">
              {children.map(c => (
                <NormRow key={c.id} category={c} items={items} categories={categories} events={journal.events} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function NormRow({ category, items, categories, events }) {
  const { updateCategory, notify } = useInventory()
  const [qty, setQty] = useState(String(category.usage_qty ?? ''))
  const [months, setMonths] = useState(String(category.usage_months ?? ''))

  const group = groupItems(items.filter(i => i.category_id === category.id), categories)[0]
  const rate = group && events ? consumptionRate(group, events) : null
  const perMonth = rate ? Math.round(rate.perDay * MONTH_DAYS * 100) / 100 : null

  // Норма зберігається парою: «2 шт», але кожні скільки? — нічого не означає.
  // Значення поля, з якого пішов фокус, беремо з події: стан міг ще не
  // оновитись, якщо введення й вихід із поля сталися впритул.
  function save(qtyRaw, monthsRaw) {
    const q = qtyRaw.trim() === '' ? null : parseQty(qtyRaw)
    const m = monthsRaw.trim() === '' ? null : parseQty(monthsRaw)
    if ((q === null) !== (m === null)) return
    if (q !== null && (q <= 0 || m <= 0)) return
    if (String(q ?? '') === String(category.usage_qty ?? '') &&
        String(m ?? '') === String(category.usage_months ?? '')) return
    updateCategory(category.id, { usage_qty: q, usage_months: m })
      .then(() => notify(q === null ? `Норму прибрано · ${category.name}` : `Норма · ${category.name}`, { tone: 'success' }))
      .catch(err => notify(err.message, { tone: 'error' }))
  }

  return (
    <li className="norm-row">
      <span className="norm-row__name">
        {category.name}
        {perMonth !== null && (
          <small className="muted">
            за журналом {formatNumber(perMonth)} на місяць{' '}
            <button type="button" className="link" onClick={() => {
              setQty(String(perMonth)); setMonths('1'); save(String(perMonth), '1')
            }}>
              взяти
            </button>
          </small>
        )}
      </span>
      <span className="norm-row__inputs">
        <input
          type="text" inputMode="decimal" value={qty}
          aria-label={`Скільки: ${category.name}`}
          onChange={e => setQty(e.target.value)} onBlur={e => save(e.target.value, months)}
        />
        <span>{group?.unit ?? 'шт'} кожні</span>
        <input
          type="text" inputMode="decimal" value={months}
          aria-label={`Кожні скільки місяців: ${category.name}`}
          onChange={e => setMonths(e.target.value)} onBlur={e => save(qty, e.target.value)}
        />
        <span>міс.</span>
      </span>
      <label className="norm-row__schedule">
        <input
          type="checkbox" checked={Boolean(category.scheduled)}
          onChange={e => {
            const on = e.target.checked
            const fields = { scheduled: on }
            // Графік без інтервалу не має сенсу: «1 кожні 3 місяці» видно одразу.
            if (on && !(Number(category.usage_months) > 0)) {
              Object.assign(fields, { usage_qty: 1, usage_months: 3 })
              setQty('1'); setMonths('3')
            }
            if (on && !category.replaced_on) fields.replaced_on = localDate()
            updateCategory(category.id, fields)
              .then(() => notify(on ? `За графіком · ${category.name}` : `Графік вимкнено · ${category.name}`, { tone: 'success' }))
              .catch(err => notify(err.message, { tone: 'error' }))
          }}
        />
        міняю за графіком
      </label>
    </li>
  )
}
