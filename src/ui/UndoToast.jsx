import { useEffect } from 'react'
import { useInventory } from '../data/InventoryContext.jsx'

export default function UndoToast() {
  const { lastAction, undo, clearLastAction, items } = useInventory()

  useEffect(() => {
    if (!lastAction) return
    const timer = setTimeout(clearLastAction, 5000)
    return () => clearTimeout(timer)
  }, [lastAction, clearLastAction])

  if (!lastAction) return null

  const item = items.find(i => i.id === lastAction.itemId)

  return (
    <div className="toast" role="status">
      <span>Витрачено {Math.abs(lastAction.applied)} · {item?.name ?? ''}</span>
      <button onClick={() => undo().catch(() => {})}>Скасувати</button>
    </div>
  )
}
