import { Link } from 'react-router-dom'
import Qty from './Qty.jsx'
import { isNeed } from '../domain/needs.js'
import { formatQty } from '../lib/format.js'
import { plural } from '../lib/plural.js'

// Відомість потреб: рядок — підкатегорія з підсумковою кількістю.
// Одна реалізація для екрана категорії й нерозкладеного, щоб рядок
// скрізь читався однаково.
export default function GroupList({ groups }) {
  return (
    <ul className="groups">
      {groups.map(group => (
        <li key={group.key}>
          <Link
            to={group.unsortedRoot ? '/unsorted'
              : group.categoryId ? `/category/${group.categoryId}`
              : `/item/${group.items[0].id}`}
            className={`group${isNeed(group) ? ' group--low' : ''}`}
          >
            <span className="group__name">
              {group.name}
              {group.categoryId && group.items.length > 1 && (
                <small className="group__sub">
                  {group.items.length} {plural(group.items.length, 'марка', 'марки', 'марок')}
                </small>
              )}
            </span>
            <span className="group__meta">
              {group.expired > 0 && <span className="group__flag">прострочено</span>}
              {group.mixedUnits
                ? <span className="qty">{group.byUnit.map(u => formatQty(u.total, u.unit)).join(' + ')}</span>
                : <Qty value={group.total} unit={group.unit} />}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
