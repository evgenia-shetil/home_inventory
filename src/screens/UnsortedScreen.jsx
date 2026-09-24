import { useNavigate } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { unsortedItems } from '../domain/home.js'
import ItemCard from '../ui/ItemCard.jsx'
import { Skeleton, Empty, ErrorState } from '../ui/States.jsx'

// Товари без категорії або причеплені до головної без підкатегорії.
// Окремий екран, щоб вони не губились і не змішувались із потребами.
export default function UnsortedScreen() {
  const navigate = useNavigate()
  const { items, categories, status, error, reload, consume } = useInventory()

  if (status === 'loading') return <Skeleton count={3} />
  if (status === 'error') return <ErrorState message={error} onRetry={reload} />

  const list = unsortedItems(items, categories)

  return (
    <div className="stack">
      <button className="back" onClick={() => navigate(-1)}>← назад</button>
      <h1>Без категорії</h1>
      {list.length === 0
        ? <Empty title="Усе розкладено" />
        : <>
            <p className="muted">
              Категорія змінюється в картці товару: Налаштування товару → Категорія.
            </p>
            <div className="grid">
              {list.map(item => (
                <ItemCard key={item.id} item={item} low={false} onConsume={consume} />
              ))}
            </div>
          </>}
    </div>
  )
}
