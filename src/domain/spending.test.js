import { describe, it, expect } from 'vitest'
import { summariseSpending } from './spending.js'

const ev = (date, price, delta, itemId, kind = 'restock') =>
  ({ id: date + itemId, created_at: date, price, delta, item_id: itemId, kind })

const items = [
  { id: 'a', name: 'Шампунь', category_id: 'c1' },
  { id: 'b', name: 'Паста', category_id: 'c2' },
]
const categories = [
  { id: 'r', name: 'тіло', parent_id: null },
  { id: 'c1', name: 'шампунь', parent_id: 'r' },
  { id: 'c2', name: 'зубна паста', parent_id: 'r' },
]

describe('summariseSpending', () => {
  it('множить ціну на кількість у кожній покупці', () => {
    const r = summariseSpending([ev('2026-09-01', 100, 2, 'a')], items, categories)
    expect(r.total).toBe(200)
  })

  it('рахує лише поповнення з ціною', () => {
    const r = summariseSpending([
      ev('2026-09-01', 100, 1, 'a'),
      ev('2026-09-02', null, 1, 'a'),
      ev('2026-09-03', 50, -1, 'a', 'consume'),
    ], items, categories)
    expect(r.total).toBe(100)
  })

  it('групує за місяцями, найновіші попереду', () => {
    const r = summariseSpending([
      ev('2026-08-10', 100, 1, 'a'),
      ev('2026-09-10', 200, 1, 'a'),
    ], items, categories)
    expect(r.months.map(m => m.key)).toEqual(['2026-09', '2026-08'])
    expect(r.months[0].total).toBe(200)
  })

  it('групує за головною категорією, а не підкатегорією', () => {
    const r = summariseSpending([
      ev('2026-09-01', 100, 1, 'a'),
      ev('2026-09-02', 50, 1, 'b'),
    ], items, categories)
    expect(r.byCategory).toEqual([{ name: 'тіло', total: 150 }])
  })

  it('порожній журнал дає нулі', () => {
    expect(summariseSpending([], items, categories)).toEqual({ total: 0, months: [], byCategory: [] })
  })
})
