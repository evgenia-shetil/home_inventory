import { describe, it, expect } from 'vitest'
import { groupItems } from './groups.js'

const cats = [
  { id: 'r1', name: 'тіло', parent_id: null, threshold: 1 },
  { id: 'c1', name: 'зубні щітки', parent_id: 'r1', threshold: 2 },
  { id: 'c2', name: 'шампунь', parent_id: 'r1', threshold: 1 },
]

const item = (id, name, qty, category_id, threshold = 1) =>
  ({ id, name, qty, category_id, threshold, unit: 'шт' })

describe('groupItems', () => {
  it('складає кількості всіх марок у межах підкатегорії', () => {
    const groups = groupItems([
      item('1', 'Colgate', 1, 'c1'),
      item('2', 'Oral-B', 2, 'c1'),
      item('3', 'Splat', 1, 'c1'),
    ], cats)

    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('зубні щітки')
    expect(groups[0].total).toBe(4)
    expect(groups[0].items).toHaveLength(3)
  })

  it('сигналить по сумі групи, а не по окремій марці', () => {
    // Чотири щітки по одній: кожна поодинці «на межі», разом — ні.
    const enough = groupItems([
      item('1', 'a', 1, 'c1'), item('2', 'b', 1, 'c1'),
      item('3', 'c', 1, 'c1'), item('4', 'd', 1, 'c1'),
    ], cats)
    expect(enough[0].low).toBe(false)

    const scarce = groupItems([item('1', 'a', 2, 'c1')], cats)
    expect(scarce[0].low).toBe(true)
  })

  it('бере поріг із категорії, а не з товару', () => {
    const groups = groupItems([item('1', 'a', 2, 'c1', 99)], cats)
    expect(groups[0].threshold).toBe(2)
  })

  it('товар без категорії лишається групою сам по собі', () => {
    const groups = groupItems([item('1', 'Окремий', 1, null, 3)], cats)
    expect(groups[0].name).toBe('Окремий')
    expect(groups[0].threshold).toBe(3)
    expect(groups[0].low).toBe(true)
  })

  it('товар прямо в головній категорії позначається як нерозкладений', () => {
    const groups = groupItems([item('1', 'a', 1, 'r1')], cats)
    expect(groups[0].name).toBe('тіло · без підкатегорії')
  })

  it('сортує за терміновістю: найближче до порога попереду', () => {
    const groups = groupItems([
      item('1', 'щітка', 10, 'c1'),   // 10 / 2 = 5
      item('2', 'шампунь', 1, 'c2'),  // 1 / 1 = 1
    ], cats)
    expect(groups.map(g => g.name)).toEqual(['шампунь', 'зубні щітки'])
  })

  it('не ділить на нуль при нульовому порозі', () => {
    const zero = [{ id: 'c3', name: 'нуль', parent_id: 'r1', threshold: 0 }]
    expect(() => groupItems([item('1', 'a', 1, 'c3')], zero)).not.toThrow()
  })

  it('порожній список дає порожній результат', () => {
    expect(groupItems([], cats)).toEqual([])
  })
})

describe('порядок усередині групи', () => {
  it('попереду те, чого лишилось найменше', () => {
    const cats = [{ id: 'c1', name: 'щітки', parent_id: null, threshold: 2 }]
    const groups = groupItems([
      { id: '1', name: 'Oral-B', qty: 3, category_id: 'c1', unit: 'шт' },
      { id: '2', name: 'Colgate', qty: 1, category_id: 'c1', unit: 'шт' },
    ], cats)
    expect(groups[0].items.map(i => i.name)).toEqual(['Colgate', 'Oral-B'])
  })
})

describe('товари просто в головній категорії', () => {
  const tree = [
    { id: 'r', name: 'обличчя', parent_id: null, threshold: 1 },
    { id: 'c', name: 'зубна щітка', parent_id: 'r', threshold: 1 },
  ]

  it('позначаються як нерозкладені, щоб не плутати з підкатегорією', () => {
    const groups = groupItems(
      [{ id: '1', name: 'Jordan', qty: 1, category_id: 'r', unit: 'шт' }], tree)
    expect(groups[0].name).toBe('обличчя · без підкатегорії')
  })

  it('без підкатегорій позначка не потрібна', () => {
    const flat = [{ id: 'r', name: 'інше', parent_id: null, threshold: 1 }]
    const groups = groupItems(
      [{ id: '1', name: 'щось', qty: 1, category_id: 'r', unit: 'шт' }], flat)
    expect(groups[0].name).toBe('інше')
  })
})
