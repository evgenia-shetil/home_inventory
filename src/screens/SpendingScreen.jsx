import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useInventory } from '../data/InventoryContext.jsx'
import { summariseSpending } from '../domain/spending.js'
import { formatPrice } from '../lib/format.js'
import { Skeleton, Empty, ErrorState } from '../ui/States.jsx'

const monthName = key => {
  const [year, month] = key.split('-')
  return new Date(Number(year), Number(month) - 1)
    .toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' })
}

export default function SpendingScreen() {
  const navigate = useNavigate()
  const { items, categories } = useInventory()
  const [events, setEvents] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('events').select('created_at,price,delta,item_id,kind')
      .eq('kind', 'restock').not('price', 'is', null)
      .order('created_at', { ascending: false }).limit(500)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setError(error.message)
        else setEvents(data)
      })
    return () => { cancelled = true }
  }, [])

  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />
  if (!events) return <Skeleton count={3} />

  const summary = summariseSpending(events, items, categories)

  return (
    <div className="stack">
      <button className="back" onClick={() => navigate(-1)}>← назад</button>
      <h1>Витрати</h1>

      {summary.total === 0
        ? <Empty title="Немає поповнень із вказаною ціною" />
        : <>
            <details className="info">
              <summary>Про розрахунок</summary>
              <p>
                Враховуються поповнення з вказаною ціною: кількість помножена на ціну
                за одиницю. Поповнення без ціни не входять, тому фактичні
                витрати можуть бути більшими.
              </p>
            </details>

            <h2>За місяцями</h2>
            <ul className="bars">
              {summary.months.map(m => (
                <li key={m.key}>
                  <span className="bars__label">{monthName(m.key)}</span>
                  <span className="bars__value">{formatPrice(m.total)}</span>
                  <span
                    className="bars__fill"
                    style={{ width: `${(m.total / summary.months[0].total) * 100}%` }}
                    aria-hidden="true"
                  />
                </li>
              ))}
            </ul>

            <h2>За категоріями</h2>
            <ul className="bars">
              {summary.byCategory.map(c => (
                <li key={c.name}>
                  <span className="bars__label">{c.name}</span>
                  <span className="bars__value">{formatPrice(c.total)}</span>
                  <span
                    className="bars__fill"
                    style={{ width: `${(c.total / summary.byCategory[0].total) * 100}%` }}
                    aria-hidden="true"
                  />
                </li>
              ))}
            </ul>
          </>}
    </div>
  )
}
