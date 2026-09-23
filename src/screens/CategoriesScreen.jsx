import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { parseQty } from '../domain/quantity.js'
import QtyInput from '../ui/QtyInput.jsx'
import Dialog from '../ui/Dialog.jsx'
import { IconTrash } from '../ui/icons.jsx'

export default function CategoriesScreen() {
  const { categories, items, createCategory, updateCategory, deleteCategory, notify } = useInventory()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [newRoot, setNewRoot] = useState('')
  const [newChild, setNewChild] = useState({})
  const [drafts, setDrafts] = useState({})
  const [targets, setTargets] = useState({})

  const roots = categories.filter(c => !c.parent_id)
  const childrenOf = id => categories.filter(c => c.parent_id === id)

  const countItems = category => {
    const ids = [category.id, ...childrenOf(category.id).map(c => c.id)]
    return items.filter(i => ids.includes(i.category_id)).length
  }

  async function run(action, okMessage) {
    setBusy(true)
    try {
      await action()
      if (okMessage) notify(okMessage, { tone: 'success' })
    } catch (err) {
      notify(err.code === '23505' ? 'Назва вже використовується на цьому рівні' : err.message,
             { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  // Назва редагується просто в рядку — так само, як у картці товару.
  // Нативний prompt() виглядав чужим і не давав ні перевірки, ні скасування.
  function handleRename(category, value) {
    const name = value.trim()
    if (!name || name === category.name) return
    run(() => updateCategory(category.id, { name }), 'Назву збережено')
  }

  async function handleDelete() {
    const category = pendingDelete
    setPendingDelete(null)
    await run(() => deleteCategory(category.id), `Видалено «${category.name}»`)
  }

  const thresholdValue = category =>
    drafts[category.id] ?? String(category.threshold ?? 1)

  // Ціль необовʼязкова: без неї список покупок просто не називає кількість.
  const targetValue = category =>
    targets[category.id] ?? String(category.target ?? '')

  const saveTarget = (category, raw) => {
    clearTimeout(timers.current['t' + category.id])
    timers.current['t' + category.id] = setTimeout(() => {
      const next = raw === '' ? null : parseQty(raw)
      setTargets(d => { const copy = { ...d }; delete copy[category.id]; return copy })
      if (String(next ?? '') === String(category.target ?? '')) return
      updateCategory(category.id, { target: next })
        .then(() => notify(next === null
          ? `Запас для «${category.name}» не задано`
          : `Запас після поповнення: ${next}`))
        .catch(err => notify(err.message, { tone: 'error' }))
    }, 700)
  }

  // Зберігаємо не на кожен дотик, а коли людина зупинилась: інакше
  // перемальовування після запису зʼїдає наступне натискання стрілки.
  const timers = useRef({})
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), [])

  const saveThreshold = (category, raw) => {
    clearTimeout(timers.current[category.id])
    timers.current[category.id] = setTimeout(() => {
      const next = parseQty(raw)
      setDrafts(d => { const copy = { ...d }; delete copy[category.id]; return copy })
      if (next === Number(category.threshold)) return
      updateCategory(category.id, { threshold: next })
        .then(() => notify(`Сигнал для «${category.name}»: ${next}`))
        .catch(err => notify(err.message, { tone: 'error' }))
    }, 700)
  }

  const row = (category, isRoot) => (
    <div key={category.id} className={`cat__row${isRoot ? ' cat__row--root' : ''}`}>
      <div className="cat__head">
        <input
          className="cat__name"
          defaultValue={category.name}
          aria-label={`Назва категорії ${category.name}`}
          onBlur={e => handleRename(category, e.target.value)}
        />
        <button
          className="link link--danger" disabled={busy}
          onClick={() => setPendingDelete(category)}
          aria-label={`Видалити категорію ${category.name}`}
        >
          <IconTrash />
        </button>
      </div>
      {!isRoot && (
        <div className="cat__numbers">
          <div className="cat__threshold">
            <span className="muted">сигнал, коли всього лишиться</span>
            <QtyInput
              value={thresholdValue(category)}
              onChange={v => setDrafts(d => ({ ...d, [category.id]: v }))}
              onCommit={v => saveThreshold(category, v)}
            />
          </div>
          <div className="cat__threshold">
            <span className="muted">запас після поповнення</span>
            <QtyInput
              value={targetValue(category)}
              onChange={v => setTargets(d => ({ ...d, [category.id]: v }))}
              onCommit={v => saveTarget(category, v)}
            />
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="stack">
      <button className="back" onClick={() => navigate(-1)}>← назад</button>
      <h1>Категорії</h1>
      <details className="info">
        <summary>Про сигнал</summary>
        <p>
          Сигнал задається на підкатегорії й рахується на всі товари в ній разом.
          Наприклад, для чотирьох різних марок зубних щіток він спрацює, коли
          їх сумарно лишиться стільки, скільки вказано.
        </p>
        <p>
          Друге число — запас після поповнення. Воно відповідає на інше питання:
          не «коли повідомити», а «скільки брати». Без нього список покупок
          не називає кількість.
        </p>
        <p>
          Головна категорія — лише папка, власного сигналу не має.
          Назва змінюється прямо в рядку.
        </p>
      </details>

      {roots.map(root => (
        <section key={root.id} className="cat">
          {row(root, true)}
          {childrenOf(root.id).map(child => row(child, false))}

          <form
            className="cat__add"
            onSubmit={e => {
              e.preventDefault()
              const name = (newChild[root.id] ?? '').trim()
              if (!name) return
              run(() => createCategory(name, root.id))
                .then(() => setNewChild(v => ({ ...v, [root.id]: '' })))
            }}
          >
            <input
              value={newChild[root.id] ?? ''}
              placeholder={`Підкатегорія в «${root.name}»`}
              onChange={e => setNewChild(v => ({ ...v, [root.id]: e.target.value }))}
            />
            <button type="submit" disabled={busy}>+</button>
          </form>
        </section>
      ))}

      <form
        className="cat__add"
        onSubmit={e => {
          e.preventDefault()
          if (!newRoot.trim()) return
          run(() => createCategory(newRoot)).then(() => setNewRoot(''))
        }}
      >
        <input
          value={newRoot}
          placeholder="Нова категорія"
          onChange={e => setNewRoot(e.target.value)}
        />
        <button type="submit" disabled={busy}>+</button>
      </form>
      {pendingDelete && (
        <Dialog
          title={`Видалити «${pendingDelete.name}»?`}
          description={[
            childrenOf(pendingDelete.id).length
              ? `Разом з нею зникнуть підкатегорії (${childrenOf(pendingDelete.id).length}).`
              : null,
            countItems(pendingDelete)
              ? `Товари (${countItems(pendingDelete)}) збережуться, але лишаться без категорії.`
              : null,
            'Скасувати цю дію буде неможливо.',
          ].filter(Boolean).join(' ')}
          confirmLabel="Видалити"
          tone="danger"
          onConfirm={handleDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  )
}
