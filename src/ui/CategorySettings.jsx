import { useEffect, useRef, useState } from 'react'
import { useInventory } from '../data/InventoryContext.jsx'
import { parseQty } from '../domain/quantity.js'
import QtyInput from './QtyInput.jsx'
import Dialog from './Dialog.jsx'
import { IconTrash } from './icons.jsx'

// Налаштування однієї категорії. Тримаються під трьома крапками, щоб
// перейменування й видалення не траплялись випадково поруч зі щоденними діями.
export default function CategorySettings({ category, onDeleted }) {
  const { items, categories, updateCategory, deleteCategory, notify } = useInventory()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [threshold, setThreshold] = useState(String(category.threshold ?? 1))
  const [target, setTarget] = useState(String(category.target ?? ''))
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
