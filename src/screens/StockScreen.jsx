import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { sortByUrgency } from '../domain/sorting.js'
import ItemCard from '../ui/ItemCard.jsx'
import CategoryStrip from '../ui/CategoryStrip.jsx'
import { Skeleton, Empty, ErrorState } from '../ui/States.jsx'

export default function StockScreen() {
  const { items, categories, status, error, reload, adjust } = useInventory()
  const [category, setCategory] = useState(null)

  if (status === 'loading') return <Skeleton />
  if (status === 'error') return <ErrorState message={error} onRetry={reload} />

  if (items.length === 0) {
    return (
      <Empty
        title="Поки що порожньо"
        action={<>
          <Link to="/scan"><button>Сканувати штрихкод</button></Link>
          <Link to="/add"><button className="ghost">Додати вручну</button></Link>
        </>}
      />
    )
  }

  const visible = sortByUrgency(
    category ? items.filter(i => i.category_id === category) : items
  )

  return (
    <>
      <CategoryStrip categories={categories} selected={category} onSelect={setCategory} />
      <div className="grid">
        {visible.map(item => (
          <ItemCard
            key={item.id}
            item={item}
            onConsume={id => adjust(id, -1, 'consume').catch(() => {})}
          />
        ))}
      </div>
      <div className="fabs">
        <Link to="/add" className="fab fab--small" aria-label="Додати товар вручну">+</Link>
        <Link to="/scan" className="fab" aria-label="Сканувати штрихкод">⌷</Link>
      </div>
    </>
  )
}
