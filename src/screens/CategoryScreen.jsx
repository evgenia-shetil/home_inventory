import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { groupItems } from '../domain/groups.js'
import { branchItems } from '../domain/home.js'
import { forecast, formatDuration } from '../domain/forecast.js'
import { useJournal } from '../lib/journal.js'
import { formatQty, formatNumber } from '../lib/format.js'
import ItemCard from '../ui/ItemCard.jsx'
import GroupList from '../ui/GroupList.jsx'
import Qty from '../ui/Qty.jsx'
import { Empty, Skeleton, ErrorState } from '../ui/States.jsx'
import CategorySettings from '../ui/CategorySettings.jsx'
import { IconMore, IconPlus } from '../ui/icons.jsx'

// Один екран на обидва рівні дерева. Головна категорія з підкатегоріями —
// це папка: показує відомість своїх потреб. Підкатегорія (або головна без
// підкатегорій) — це сама потреба: підсумок і марки.
export default function CategoryScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, categories, status, error, reload, consume } = useInventory()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const journal = useJournal()

  // Без цієї перевірки під час завантаження на мить показувалось
  // «Категорію не знайдено» — список категорій ще порожній.
  if (status === 'loading') return <Skeleton count={4} />
  if (status === 'error') return <ErrorState message={error} onRetry={reload} />

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

  const isFolder = !category.parent_id && categories.some(c => c.parent_id === id)

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

      {isFolder
        ? <Folder groups={groupItems(branchItems(id, items, categories), categories)} />
        : <Need
            group={groupItems(items.filter(i => i.category_id === id), categories)[0]}
            events={journal.events}
            consume={consume}
          />}

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

function Folder({ groups }) {
  if (!groups.length) return <Empty title="Категорія порожня" />
  return <GroupList groups={groups} />
}

function Need({ group, events, consume }) {
  if (!group) return <Empty title="Категорія порожня" />
  const outlook = events ? forecast(group, events) : null
  const unitless = value => (group.mixedUnits ? formatNumber(value) : formatQty(value, group.unit))

  return (
    <>
      {/* Цифра — головний елемент екрана, пояснення — підписи під нею. */}
      <div className={`needhead${group.low ? ' needhead--low' : ''}`}>
        {group.mixedUnits
          ? <span className="qty needhead__qty">{group.byUnit.map(u => formatQty(u.total, u.unit)).join(' + ')}</span>
          : <Qty value={group.total} unit={group.unit} className="needhead__qty" />}
        <ul className="needhead__facts">
          {/* Зі змішаними одиницями одиниця групи — це одиниця першої марки,
              тож підписувати нею частини суми було б неправдою. */}
          {group.inUse > 0 && <li>{unitless(group.inUse)} у користуванні</li>}
          {group.expired > 0 && <li className="error">{unitless(group.expired)} прострочено</li>}
          <li>сигнал на {unitless(group.threshold)}</li>
          {outlook && outlook.daysLeft >= 1 && (
            <li>вистачить приблизно на {formatDuration(outlook.daysLeft)}</li>
          )}
        </ul>
      </div>

      {group.mixedUnits && (
        <p className="note">
          Різні одиниці виміру, тож спільного підсумку немає, а сигнал рахується
          неточно. Товари в мл чи г переводяться в упаковки в картці:
          Налаштування товару → Рахувати упаковками.
        </p>
      )}

      <div className="grid">
        {group.items.map(item => (
          <ItemCard key={item.id} item={item} low={group.low} onConsume={consume} />
        ))}
      </div>
    </>
  )
}
