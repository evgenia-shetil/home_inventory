import { useState } from 'react'
import { useInventory } from '../data/InventoryContext.jsx'
import { IconPlus } from './icons.jsx'

const NEW = '__new__'

// Випадайник категорії, який уміє створити нову, не виходячи з форми.
// parentId = null означає головну категорію, інакше — підкатегорію в ній.
export default function CategorySelect({
  value, onChange, parentId = null, emptyLabel = 'без категорії', disabled = false,
}) {
  const { categories, createCategory } = useInventory()
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // Поки батька не обрано, список порожній: інакше випадайник підкатегорії
  // показував би головні категорії, бо для них parent_id теж null.
  const options = disabled
    ? []
    : categories.filter(c => (c.parent_id ?? null) === parentId)

  async function save() {
    const name = draft.trim()
    if (!name) return

    setBusy(true)
    setError(null)
    try {
      const created = await createCategory(name, parentId)
      onChange(created.id)
      setTyping(false)
      setDraft('')
    } catch (err) {
      setError(err.code === '23505' ? 'Назва вже використовується на цьому рівні' : err.message)
    } finally {
      setBusy(false)
    }
  }

  if (typing) {
    return (
      <div className="newcat">
        <div className="newcat__row">
          <input
            value={draft}
            placeholder="Назва категорії"
            autoFocus
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); save() }
              if (e.key === 'Escape') setTyping(false)
            }}
          />
          <button type="button" onClick={save} disabled={busy} aria-label="Створити категорію"><IconPlus /></button>
        </div>
        {error && <span className="error">{error}</span>}
        <button type="button" className="link" onClick={() => { setTyping(false); setError(null) }}>
          Обрати зі списку
        </button>
      </div>
    )
  }

  return (
    <select
      value={value ?? ''}
      disabled={disabled}
      onChange={e => {
        if (e.target.value === NEW) setTyping(true)
        else onChange(e.target.value)
      }}
    >
      <option value="">{emptyLabel}</option>
      {options.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      {!disabled && <option value={NEW}>+ нова категорія…</option>}
    </select>
  )
}
