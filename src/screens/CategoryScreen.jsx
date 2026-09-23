import { useParams, useNavigate, Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { groupItems } from '../domain/groups.js'
import { formatQty } from '../lib/format.js'
import ItemCard from '../ui/ItemCard.jsx'
import { Empty } from '../ui/States.jsx'

export default function CategoryScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, categories, adjust } = useInventory()

  const category = categories.find(c => c.id === id)
  if (!category) return <p className="muted">Категорію не знайдено.</p>

  const [group] = groupItems(items.filter(i => i.category_id === id), categories)

  return (
    <>
      <button className="back" onClick={() => navigate(-1)}>← назад</button>
      <h1>{category.name}</h1>

      {group
        ? <p className={group.low ? 'error' : 'muted'}>
            Всього {formatQty(group.total, group.unit)}, сигнал на {formatQty(group.threshold, group.unit)}
          </p>
        : <Empty title="У цій категорії поки порожньо" />}

      {group && (
        <div className="grid">
          {group.items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              low={group.low}
              onConsume={itemId => adjust(itemId, -1, 'consume').catch(() => {})}
            />
          ))}
        </div>
      )}

      <Link to={`/add?category=${id}`} className="linkline">Додати товар у цю категорію</Link>
    </>
  )
}
