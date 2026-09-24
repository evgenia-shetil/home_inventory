import { useInventory } from '../data/InventoryContext.jsx'
import { plural } from '../lib/plural.js'

const time = iso => new Date(iso).toLocaleString('uk-UA', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})

// Без мережі важливо розуміти дві речі: наскільки старі числа на екрані
// і чи є дотики, які ще не дійшли до бази.
export default function NetworkBanner() {
  const { online, staleSince, pending, sync, notify } = useInventory()
  if (online && !staleSince && !pending) return null

  const parts = [
    online ? 'Дані не оновлено.' : 'Немає звʼязку.',
    staleSince ? `Показано стан на ${time(staleSince)}.` : null,
    pending
      ? `${pending} ${plural(pending, 'операція чекає', 'операції чекають', 'операцій чекають')} на відправку.`
      : null,
    online ? null : 'Підключення відновиться автоматично.',
  ]

  return (
    <div className="banner" role="alert">
      <span>{parts.filter(Boolean).join(' ')}</span>
      {online && (
        <button type="button" onClick={() => sync().catch(err => notify(err.message, { tone: 'error' }))}>
          Оновити
        </button>
      )}
    </div>
  )
}
