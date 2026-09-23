import { describe, it, expect } from 'vitest'
import { applyDelta } from './optimistic.js'

const list = () => [
  { id: 'a', name: 'а', qty: 3 },
  { id: 'b', name: 'б', qty: 0 },
]

describe('applyDelta', () => {
  it('змінює кількість потрібного товару', () => {
    const { items } = applyDelta(list(), 'a', -1)
    expect(items.find(i => i.id === 'a').qty).toBe(2)
    expect(items.find(i => i.id === 'b').qty).toBe(0)
  })

  it('повертає фактично застосовану зміну', () => {
    const { applied } = applyDelta(list(), 'a', -1)
    expect(applied).toBe(-1)
  })

  it('обмежує нулем і повертає урізану зміну', () => {
    const { items, applied } = applyDelta(list(), 'b', -5)
    expect(items.find(i => i.id === 'b').qty).toBe(0)
    expect(applied).toBe(0)
  })

  // Головний тест цього модуля. Відкат має скасовувати саме те,
  // що було застосовано, а не повертати запам'ятоване значення —
  // інакше паралельний тап, що встиг пройти, буде затертий.
  it('відкат зворотною зміною не затирає паралельний тап', () => {
    const first = applyDelta(list(), 'a', -1)          // 3 -> 2
    const second = applyDelta(first.items, 'a', -1)    // 2 -> 1
    const reverted = applyDelta(second.items, 'a', -first.applied) // +1 -> 2
    expect(reverted.items.find(i => i.id === 'a').qty).toBe(2)
  })

  it('відкат урізаної зміни нічого не додає', () => {
    const applyResult = applyDelta(list(), 'b', -5)
    const reverted = applyDelta(applyResult.items, 'b', -applyResult.applied)
    expect(reverted.items.find(i => i.id === 'b').qty).toBe(0)
  })

  it('не мутує вхідний масив', () => {
    const items = list()
    const copy = JSON.parse(JSON.stringify(items))
    applyDelta(items, 'a', -1)
    expect(items).toEqual(copy)
  })

  it('ігнорує невідомий id', () => {
    const { items, applied } = applyDelta(list(), 'немає', -1)
    expect(applied).toBe(0)
    expect(items.map(i => i.qty)).toEqual([3, 0])
  })
})
