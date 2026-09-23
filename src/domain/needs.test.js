import { describe, it, expect } from 'vitest'
import { toBuy, shoppingGroups } from './needs.js'

describe('toBuy', () => {
  it('рахує різницю до цілі', () => {
    expect(toBuy({ total: 1, target: 4 })).toBe(3)
  })

  it('нуль, коли вже достатньо', () => {
    expect(toBuy({ total: 5, target: 4 })).toBe(0)
  })

  it('без цілі відповіді немає', () => {
    expect(toBuy({ total: 1, target: null })).toBeNull()
    expect(toBuy({ total: 1 })).toBeNull()
  })
})

describe('shoppingGroups', () => {
  const group = (key, items, low = true) => ({ key, name: key, items, low, total: 0, threshold: 1 })

  it('бере лише те, що нижче порога', () => {
    const groups = [group('a', [{ id: '1', recurring: true }]), { ...group('b', [{ id: '2', recurring: true }]), low: false }]
    expect(shoppingGroups(groups).map(g => g.key)).toEqual(['a'])
  })

  it('прибирає разові речі зі списку покупок', () => {
    const groups = [group('a', [{ id: '1', recurring: false }, { id: '2', recurring: true }])]
    expect(shoppingGroups(groups)[0].items.map(i => i.id)).toEqual(['2'])
  })

  it('прибирає групу, де всі речі разові', () => {
    const groups = [group('a', [{ id: '1', recurring: false }])]
    expect(shoppingGroups(groups)).toEqual([])
  })

  // Старі записи не мають поля — вважаємо їх поновлюваними
  it('відсутнє поле означає «поповнювати»', () => {
    const groups = [group('a', [{ id: '1' }])]
    expect(shoppingGroups(groups)[0].items).toHaveLength(1)
  })
})
