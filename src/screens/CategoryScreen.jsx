import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { groupItems } from '../domain/groups.js'
import { forecast, formatDuration } from '../domain/forecast.js'
import { useJournal } from '../lib/journal.js'
import { formatQty } from '../lib/format.js'
import ItemCard from '../ui/ItemCard.jsx'
import { Empty } from '../ui/States.jsx'
import CategorySettings from '../ui/CategorySettings.jsx'
import { IconMore, IconPlus } from '../ui/icons.jsx'

export default function CategoryScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, categories, adjust, notify } = useInventory()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const journal = useJournal()

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
  const outlook = group && journal.events ? forecast(group, journal.events) : null

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
          У категорії різні одиниці виміру, тож спільного підсумку немає, а
          сигнал рахується неточно. Товари в мл чи г переводяться в упаковки
          в картці: Налаштування товару → Рахувати упаковками.
        </p>
      )}

      {group
        ? <p className={group.low ? 'error' : 'muted'}>
            Всього {group.mixedUnits
              ? group.byUnit.map(u => formatQty(u.total, u.unit)).join(' + ')
              : formatQty(group.total, group.unit)}
            {group.inUse > 0 && `, з них ${formatQty(group.inUse, group.unit)} у користуванні`}
            {group.expired > 0 && `, ${formatQty(group.expired, group.unit)} прострочено`}
            , сигнал на {formatQty(group.threshold, group.unit)}
          </p>
        : <Empty title="Категорія порожня" />}

      {outlook && outlook.daysLeft >= 1 && (
        <p className="muted">
          За темпом витрачання вистачить приблизно на {formatDuration(outlook.daysLeft)}
        </p>
      )}

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

      {/* Та сама плаваюча кнопка, що й на головному екрані: додавання
          товару має виглядати однаково, хоч звідки його починати. */}
      <div className="fabs">
        <Link
          to={`/add?category=${id}`}
          className="fab"
          aria-label={`Додати товар у категорію ${category.name}`}
        >
          <IconPlus />
        </Link>
      </div>
    </>
  )
}
