import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { groupItems } from '../domain/groups.js'
import { formatQty } from '../lib/format.js'
import ItemCard from '../ui/ItemCard.jsx'
import { Empty } from '../ui/States.jsx'
import CategorySettings from '../ui/CategorySettings.jsx'
import { IconMore } from '../ui/icons.jsx'

export default function CategoryScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, categories, adjust, notify } = useInventory()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const category = categories.find(c => c.id === id)
  if (!category) {
    return (
      <div className="stack">
        <h1>Категорію не знайдено</h1>
        <p className="muted">Категорію видалено або перейменовано.</p>
        <Link to="/"><button>До запасів</button></Link>
      </div>
    )
  }

  const [group] = groupItems(items.filter(i => i.category_id === id), categories)

  return (
    <>
      <button className="back" onClick={() => navigate(-1)}>← назад</button>
      <div className="screenhead">
        <h1>{category.name}</h1>
        <button
          className="iconbtn"
          aria-label="Налаштування категорії"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(o => !o)}
        >
          <IconMore />
        </button>
      </div>

      {settingsOpen && (
        <CategorySettings category={category} onDeleted={() => navigate('/')} />
      )}

      {group?.mixedUnits && (
        <p className="error">
          У категорії різні одиниці виміру, тому підсумок некоректний.
          Одиниці зводяться до однієї в картках товарів.
        </p>
      )}

      {group
        ? <p className={group.low ? 'error' : 'muted'}>
            Всього {formatQty(group.total, group.unit)}
            {group.inUse > 0 && `, з них ${formatQty(group.inUse, group.unit)} у користуванні`}
            , сигнал на {formatQty(group.threshold, group.unit)}
          </p>
        : <Empty title="Категорія порожня" />}

      {group && (
        <div className="grid">
          {group.items.map(item => (
            <ItemCard
              key={item.id}
              item={item}
              low={group.low}
              onConsume={itemId => {
                const target = items.find(i => i.id === itemId)
                const bucket = Number(target?.in_use ?? 0) > 0 ? 'in_use' : 'stock'
                return adjust(itemId, -1, 'consume', { bucket })
                  .catch(err => notify(err.message, { tone: 'error' }))
              }}
            />
          ))}
        </div>
      )}

      <Link to={`/add?category=${id}`} className="linkline">Додати товар у категорію</Link>
    </>
  )
}
