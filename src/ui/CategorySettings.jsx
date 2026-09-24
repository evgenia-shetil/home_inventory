import { useEffect, useRef, useState } from 'react'
import { useInventory } from '../data/InventoryContext.jsx'
import { parseQty } from '../domain/quantity.js'
import { groupItems } from '../domain/groups.js'
import { consumptionRate, MONTH_DAYS } from '../domain/forecast.js'
import { nextReplacement } from '../domain/plan.js'
import { localDate } from '../domain/expiry.js'
import { useJournal } from '../lib/journal.js'
import { formatNumber } from '../lib/format.js'
import QtyInput from './QtyInput.jsx'
import Dialog from './Dialog.jsx'
import { IconTrash } from './icons.jsx'

const longDate = iso =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })

// Налаштування однієї категорії. Тримаються під трьома крапками, щоб
// перейменування й видалення не траплялись випадково поруч зі щоденними діями.
export default function CategorySettings({ category, onDeleted }) {
  const { items, categories, updateCategory, deleteCategory, notify } = useInventory()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [threshold, setThreshold] = useState(String(category.threshold ?? 1))
  const [target, setTarget] = useState(String(category.target ?? ''))
  const [usageQty, setUsageQty] = useState(String(category.usage_qty ?? ''))
  const [usageMonths, setUsageMonths] = useState(String(category.usage_months ?? ''))
  const [replacedOn, setReplacedOn] = useState(category.replaced_on ?? '')
  const journal = useJournal()
  const timers = useRef({})

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), [])

  const isRoot = !category.parent_id
  const children = categories.filter(c => c.parent_id === category.id)
  const affected = items.filter(i =>
    i.category_id === category.id || children.some(c => c.id === i.category_id)).length

  const fail = err => notify(
    err.code === '23505' ? 'Назва вже використовується на цьому рівні' : err.message,
    { tone: 'error' })

  function rename(value) {
    const name = value.trim()
    if (!name || name === category.name) return
    updateCategory(category.id, { name })
      .then(() => notify('Назву збережено', { tone: 'success' }))
      .catch(fail)
  }

  // Зберігаємо після паузи: запис перемальовує список, і натискання,
  // що потрапило в цей момент, інакше губиться.
  function saveLater(key, fields, message) {
    clearTimeout(timers.current[key])
    timers.current[key] = setTimeout(() => {
      updateCategory(category.id, fields)
        .then(() => notify(message, { tone: 'success' }))
        .catch(fail)
    }, 700)
  }

  // Норма зберігається парою: половина норми («2 шт», але кожні скільки?)
  // нічого не означає, тож пишемо, лише коли обидва числа задані або обидва порожні.
  function saveNorm(qtyRaw, monthsRaw) {
    const qty = qtyRaw === '' ? null : parseQty(qtyRaw)
    const months = monthsRaw === '' ? null : parseQty(monthsRaw)
    if ((qty === null) !== (months === null)) return
    if (qty !== null && (qty <= 0 || months <= 0)) return
    saveLater('norm', { usage_qty: qty, usage_months: months },
      qty === null ? 'Норму прибрано' : `Норма: ${formatNumber(qty)} кожні ${formatNumber(months)} міс.`)
  }

  const group = groupItems(items.filter(i => i.category_id === category.id), categories)[0]
  const journalRate = group && journal.events ? consumptionRate(group, journal.events) : null
  const journalPerMonth = journalRate ? Math.round(journalRate.perDay * MONTH_DAYS * 100) / 100 : null
  const next = nextReplacement(category, localDate())

  return (
    <section className="catsettings">
      <label className="field">
        Назва
        <input defaultValue={category.name} onBlur={e => rename(e.target.value)} />
      </label>

      {!isRoot && (
        <>
          <div className="field">
            Сигнал, коли всього лишиться
            <QtyInput
              value={threshold}
              onChange={setThreshold}
              onCommit={v => saveLater('threshold', { threshold: parseQty(v) },
                `Сигнал: ${parseQty(v)}`)}
            />
          </div>

          <div className="field">
            Запас після поповнення
            <QtyInput
              value={target}
              onChange={setTarget}
              onCommit={v => saveLater('target', { target: v === '' ? null : parseQty(v) },
                v === '' ? 'Запас не задано' : `Запас після поповнення: ${parseQty(v)}`)}
            />
          </div>

          {/* Норма потрібна плану закупівлі: без неї на пів року вперед
              не порахувати, поки журнал не набере історію. */}
          <div className="field">
            Норма витрачання
            {/* Два поля одне під одним: у рядок на телефоні вони не
                вміщувались, і числа ховались за кнопками. */}
            <div className="norm">
              <span>Скільки</span>
              <QtyInput value={usageQty} onChange={setUsageQty} unit={group?.unit}
                        onCommit={v => saveNorm(v, usageMonths)} />
              <span>Кожні, місяців</span>
              <QtyInput value={usageMonths} onChange={setUsageMonths}
                        onCommit={v => saveNorm(usageQty, v)} />
            </div>
            {journalPerMonth !== null && (
              <small className="muted">
                За журналом: {formatNumber(journalPerMonth)} на місяць.{' '}
                <button type="button" className="link" onClick={() => {
                  setUsageQty(String(journalPerMonth)); setUsageMonths('1')
                  saveNorm(String(journalPerMonth), '1')
                }}>
                  Взяти за норму
                </button>
              </small>
            )}
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={Boolean(category.scheduled)}
              onChange={e => {
                const on = e.target.checked
                // Графік без інтервалу не має сенсу: підставляємо звичне
                // «1 кожні 3 місяці», яке одразу видно й можна змінити.
                const fields = { scheduled: on }
                if (on && !(Number(category.usage_months) > 0)) {
                  Object.assign(fields, { usage_qty: 1, usage_months: 3 })
                  setUsageQty('1'); setUsageMonths('3')
                }
                if (on && !category.replaced_on) {
                  fields.replaced_on = localDate()
                  setReplacedOn(fields.replaced_on)
                }
                updateCategory(category.id, fields)
                  .then(() => notify(on ? 'Міняється за графіком' : 'Графік вимкнено', { tone: 'success' }))
                  .catch(fail)
              }}
            />
            <span>
              Міняю за графіком
              <small className="muted">
                Для речей, які не закінчуються, а міняються в дату: щітка, фільтр.
                Застосунок нагадає, коли час замінити.
              </small>
            </span>
          </label>

          {category.scheduled && (
            <label className="field">
              Остання заміна
              <input
                type="date" value={replacedOn}
                onChange={e => setReplacedOn(e.target.value)}
                onBlur={() => {
                  const value = replacedOn || null
                  if (value === (category.replaced_on ?? null)) return
                  updateCategory(category.id, { replaced_on: value })
                    .then(() => notify('Дату заміни збережено', { tone: 'success' }))
                    .catch(fail)
                }}
              />
              {next && <small className="muted">Наступна — {longDate(next)}</small>}
            </label>
          )}
        </>
      )}

      <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>
        <IconTrash /> Видалити категорію
      </button>

      {confirmDelete && (
        <Dialog
          title={`Видалити «${category.name}»?`}
          description={[
            children.length ? `Разом з нею зникнуть підкатегорії (${children.length}).` : null,
            affected ? `Товари (${affected}) збережуться, але лишаться без категорії.` : null,
            'Скасувати цю дію буде неможливо.',
          ].filter(Boolean).join(' ')}
          confirmLabel="Видалити"
          tone="danger"
          onConfirm={() => {
            setConfirmDelete(false)
            deleteCategory(category.id)
              .then(() => { notify(`Видалено «${category.name}»`, { tone: 'success' }); onDeleted?.() })
              .catch(fail)
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </section>
  )
}
