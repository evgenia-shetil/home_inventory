import { describe, it, expect } from 'vitest'
import { sortByUrgency, isLow } from './sorting.js'

const item = (name, qty, threshold) => ({ id: name, name, qty, threshold })

describe('sortByUrgency', () => {
  it('ставить попереду те, що ближче до порога у відносному вимірі', () => {
    const items = [
      item('сіль', 1, 1),     // 1.0
      item('папір', 4, 10),   // 0.4
      item('мило', 3, 2),     // 1.5
    ]
    expect(sortByUrgency(items).map(i => i.name)).toEqual(['папір', 'сіль', 'мило'])
  })

  it('не ділить на нуль при нульовому порозі', () => {
    const items = [item('а', 5, 0), item('б', 1, 1)]
    expect(() => sortByUrgency(items)).not.toThrow()
    expect(sortByUrgency(items).map(i => i.name)).toEqual(['б', 'а'])
  })

  it('при однаковій терміновості сортує за назвою українською', () => {
    const items = [item('яблуко', 1, 1), item('банан', 1, 1), item('їжак', 1, 1)]
    expect(sortByUrgency(items).map(i => i.name)).toEqual(['банан', 'їжак', 'яблуко'])
  })

  it('не мутує вхідний масив', () => {
    const items = [item('б', 5, 1), item('а', 1, 1)]
    const copy = [...items]
    sortByUrgency(items)
    expect(items).toEqual(copy)
  })
})

describe('isLow', () => {
  it('вважає низьким, коли кількість не більша за поріг', () => {
    expect(isLow(item('а', 1, 1))).toBe(true)
    expect(isLow(item('а', 0, 1))).toBe(true)
    expect(isLow(item('а', 2, 1))).toBe(false)
  })
})
