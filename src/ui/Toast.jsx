import { useEffect } from 'react'
import { useInventory } from '../data/InventoryContext.jsx'

// Один канал повідомлень на весь застосунок. Раніше підтвердження діяли
// по-різному на різних екранах, а частина дій не повідомляла про себе взагалі.
export default function Toast() {
  const { notice, dismissNotice, notify } = useInventory()

  useEffect(() => {
    if (!notice) return
    // Помилку лишаємо довше: її треба встигнути прочитати й зрозуміти.
    const timer = setTimeout(dismissNotice, notice.tone === 'error' ? 8000 : 5000)
    return () => clearTimeout(timer)
  }, [notice, dismissNotice])

  if (!notice) return null

  async function undo() {
    dismissNotice()
    try {
      await notice.undo()
      notify('Скасовано')
    } catch (err) {
      notify(err.message, { tone: 'error' })
    }
  }

  return (
    <div className={`toast${notice.tone === 'error' ? ' toast--error' : ''}`} role="status">
      <span>{notice.text}</span>
      {notice.undo
        ? <button onClick={undo}>Скасувати</button>
        : <button onClick={dismissNotice} aria-label="Закрити повідомлення">×</button>}
    </div>
  )
}
