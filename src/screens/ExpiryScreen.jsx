import { useNavigate, Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { expiringItems, describeExpiry, SOON_DAYS } from '../domain/expiry.js'
import { plural } from '../lib/plural.js'
import Qty from '../ui/Qty.jsx'
import { Skeleton, Empty, ErrorState } from '../ui/States.jsx'

// Окремий погляд на терміни: «закінчується» й «псується» — різні
// питання, і в одному переліку одне маскувало б інше.
export default function ExpiryScreen() {
  const navigate = useNavigate()
  const { items, status, error, reload } = useInventory()

  if (status === 'loading') return <Skeleton count={3} />
  if (status === 'error') return <ErrorState message={error} onRetry={reload} />

  const list = expiringItems(items)
  const expired = list.filter(x => x.expiry.state === 'expired')
  const soon = list.filter(x => x.expiry.state === 'soon')

  return (
    <div className="stack">
      <button className="back" onClick={() => navigate(-1)}>← назад</button>
      <h1>Термін придатності</h1>

      {list.length === 0 && <Empty title="Простроченого немає" />}

      <Section title="Прострочено" rows={expired}
               note="Не рахується в запас: потреба в таких речах уже в списку покупок." />
      <Section title={`Скоро, до ${SOON_DAYS} ${plural(SOON_DAYS, 'дня', 'днів', 'днів')}`} rows={soon} />

      <p className="muted">
        Дата задається в картці товару або під час поповнення.
      </p>
    </div>
  )
}

function Section({ title, rows, note }) {
  if (!rows.length) return null
  return (
    <section className="stack">
      <h2>{title}</h2>
      {note && <p className="muted">{note}</p>}
      <ul className="groups">
        {rows.map(({ item, expiry }) => (
          <li key={item.id}>
            <Link to={`/item/${item.id}`}
                  className={`group${expiry.state === 'expired' ? ' group--expired' : ''}`}>
              <span className="group__name">
                {item.name}
                <small className="group__sub">{describeExpiry(expiry)}</small>
              </span>
              <span className="group__meta">
                <Qty value={Number(item.qty) + Number(item.in_use ?? 0)} unit={item.unit} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
