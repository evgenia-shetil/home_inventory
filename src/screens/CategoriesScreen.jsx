import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { parseQty } from '../domain/quantity.js'
import QtyInput from '../ui/QtyInput.jsx'

export default function CategoriesScreen() {
  const { categories, items, createCategory, updateCategory, deleteCategory } = useInventory()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [newRoot, setNewRoot] = useState('')
  const [newChild, setNewChild] = useState({})
  const [drafts, setDrafts] = useState({})

  const roots = categories.filter(c => !c.parent_id)
  const childrenOf = id => categories.filter(c => c.parent_id === id)

  const countItems = category => {
    const ids = [category.id, ...childrenOf(category.id).map(c => c.id)]
    return items.filter(i => ids.includes(i.category_id)).length
  }

  async function run(action) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err.code === '23505' ? 'Така назва вже є на цьому рівні' : err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRename(category) {
    const name = prompt('Нова назва', category.name)
    if (!name || name.trim() === category.name) return
    await run(() => updateCategory(category.id, { name: name.trim() }))
  }

  async function handleDelete(category) {
    const kids = childrenOf(category.id).length
    const count = countItems(category)
    const parts = [`Видалити «${category.name}»?`]
    if (kids) parts.push(`Разом з нею зникнуть ${kids} підкатегорій.`)
    if (count) parts.push(`${count} товарів лишаться без категорії, але не зникнуть.`)
    if (!confirm(parts.join(' '))) return
    await run(() => deleteCategory(category.id))
  }

  const thresholdValue = category =>
    drafts[category.id] ?? String(category.threshold ?? 1)

  const saveThreshold = category => {
    const next = parseQty(thresholdValue(category))
    setDrafts(d => { const copy = { ...d }; delete copy[category.id]; return copy })
    if (next === Number(category.threshold)) return
    run(() => updateCategory(category.id, { threshold: next }))
  }

  const row = (category, isRoot) => (
    <div key={category.id} className={`cat__row${isRoot ? ' cat__row--root' : ''}`}>
      <div className="cat__head">
        <span>{category.name}</span>
        <span className="cat__actions">
          <button className="link" disabled={busy} onClick={() => handleRename(category)}>назва</button>
          <button className="link" disabled={busy} onClick={() => handleDelete(category)}>видалити</button>
        </span>
      </div>
      {!isRoot && <div className="cat__threshold">
        <span className="muted">сигнал, коли всього лишиться</span>
        <QtyInput
          value={thresholdValue(category)}
          onChange={v => {
            setDrafts(d => ({ ...d, [category.id]: v }))
            // Стрілки міняють значення одразу, тож зберігаємо без очікування blur.
            if (v !== thresholdValue(category)) return
          }}
        />
        <button className="link" disabled={busy} onClick={() => saveThreshold(category)}>
          зберегти поріг
        </button>
      </div>}
    </div>
  )

  return (
    <div className="stack">
      <button className="back" onClick={() => navigate(-1)}>← назад</button>
      <h1>Категорії</h1>
      <p className="muted">
        Сигнал «закінчується» задається на підкатегорії й рахується на всі товари
        в ній разом: якщо зубних щіток чотири різні, сигнал прийде, коли їх
        сумарно лишиться стільки, скільки тут вказано. Головна категорія — лише
        папка, власного сигналу вона не має.
      </p>
      {error && <p className="error">{error}</p>}

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
              placeholder={`підкатегорія в «${root.name}»`}
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
          placeholder="нова головна категорія"
          onChange={e => setNewRoot(e.target.value)}
        />
        <button type="submit" disabled={busy}>+</button>
      </form>
    </div>
  )
}
