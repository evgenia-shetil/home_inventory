import { describe, it, expect } from 'vitest'
import { groupItems, dominantUnit } from './groups.js'

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

  it('ставить попереду те, що потребує уваги, далі — сталий порядок', () => {
    const groups = groupItems([
      item('1', 'щітка', 10, 'c1'),   // запасу вдосталь
      item('2', 'шампунь', 1, 'c2'),  // на межі
    ], cats)
    expect(groups.map(g => g.name)).toEqual(['шампунь', 'зубні щітки'])
  })

  it('порядок не перемішується, поки стан не змінився', () => {
    const many = [
      item('1', 'a', 9, 'c1'), item('2', 'b', 3, 'c1'),
    ]
    const cats2 = [
      { id: 'c1', name: 'алое', parent_id: null, threshold: 1 },
      { id: 'c2', name: 'банан', parent_id: null, threshold: 1 },
    ]
    const first = groupItems([{ ...many[0], category_id: 'c1' }, { id: '3', name: 'c', qty: 5, category_id: 'c2', unit: 'шт' }], cats2)
    const after = groupItems([{ ...many[0], qty: 4, category_id: 'c1' }, { id: '3', name: 'c', qty: 5, category_id: 'c2', unit: 'шт' }], cats2)
    expect(first.map(g => g.name)).toEqual(after.map(g => g.name))
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

describe('поріг лише на підкатегорії', () => {
  const tree = [
    { id: 'r', name: 'обличчя', parent_id: null, threshold: 99 },
    { id: 'c', name: 'зубна щітка', parent_id: 'r', threshold: 3 },
  ]

  it('підкатегорія задає поріг групи', () => {
    const groups = groupItems(
      [{ id: '1', name: 'Jordan', qty: 5, category_id: 'c', unit: 'шт', threshold: 1 }], tree)
    expect(groups[0].threshold).toBe(3)
  })

  it('головна категорія свого порога не має — працює запасний з товару', () => {
    const groups = groupItems(
      [{ id: '1', name: 'щось', qty: 5, category_id: 'r', unit: 'шт', threshold: 2 }], tree)
    expect(groups[0].threshold).toBe(2)
  })
})

describe('змішані одиниці', () => {
  const cats = [{ id: 'c', name: 'шампунь', parent_id: 'r', threshold: 1 }]

  it('позначає групу, де складаються різні одиниці', () => {
    const groups = groupItems([
      { id: '1', name: 'a', qty: 1, category_id: 'c', unit: 'шт' },
      { id: '2', name: 'b', qty: 500, category_id: 'c', unit: 'мл' },
    ], cats)
    expect(groups[0].mixedUnits).toBe(true)
  })

  it('однакові одиниці позначки не мають', () => {
    const groups = groupItems([
      { id: '1', name: 'a', qty: 1, category_id: 'c', unit: 'шт' },
      { id: '2', name: 'b', qty: 2, category_id: 'c', unit: 'шт' },
    ], cats)
    expect(groups[0].mixedUnits).toBe(false)
  })
})

describe('запас у шафі й у користуванні', () => {
  const cats = [{ id: 'c', name: 'антижир', parent_id: 'r', threshold: 0 }]
  const item = (qty, inUse) => ({ id: '1', name: 'Tiret', qty, in_use: inUse, category_id: 'c', unit: 'шт' })

  it('відкрита пляшка закриває потребу так само, як запас у шафі', () => {
    const [g] = groupItems([item(0, 1)], cats)
    expect(g.total).toBe(1)
    expect(g.low).toBe(false)
  })

  it('сигнал приходить, коли скінчилось і в шафі, і в користуванні', () => {
    const [g] = groupItems([item(0, 0)], cats)
    expect(g.total).toBe(0)
    expect(g.low).toBe(true)
  })

  it('розділяє два лічильники для показу', () => {
    const [g] = groupItems([item(2, 1)], cats)
    expect(g.inStock).toBe(2)
    expect(g.inUse).toBe(1)
    expect(g.total).toBe(3)
  })

  // Зубні щітки: поріг 2 на суму — відкрита щітка теж рахується
  it('поріг більший за нуль працює на сумі', () => {
    const brushes = [{ id: 'b', name: 'щітки', parent_id: 'r', threshold: 2 }]
    const make = (id, qty, inUse) => ({ id, name: id, qty, in_use: inUse, category_id: 'b', unit: 'шт' })
    expect(groupItems([make('1', 3, 0), make('2', 0, 1)], brushes)[0].low).toBe(false)
    expect(groupItems([make('1', 1, 0), make('2', 0, 1)], brushes)[0].low).toBe(true)
  })

  it('товари без нового поля рахуються як раніше', () => {
    const [g] = groupItems([{ id: '1', name: 'старий', qty: 5, category_id: 'c', unit: 'шт' }], cats)
    expect(g.total).toBe(5)
    expect(g.inUse).toBe(0)
  })
})

describe('groupItems і терміни придатності', () => {
  const meds = [{ id: 'm', name: 'знеболювальне', parent_id: 'r', threshold: 1 }]
  const pill = (id, qty, expires_on) =>
    ({ id, name: id, qty, in_use: 0, category_id: 'm', unit: 'шт', expires_on })
  const today = '2026-09-24'

  // Три упаковки прострочених ліків — це нуль упаковок
  it('прострочене не закриває потребу', () => {
    const [g] = groupItems([pill('старі', 3, '2026-09-01')], meds, today)
    expect(g.total).toBe(3)
    expect(g.expired).toBe(3)
    expect(g.usable).toBe(0)
    expect(g.low).toBe(true)
  })

  it('придатний запас поруч із простроченим рахується', () => {
    const [g] = groupItems([pill('старі', 3, '2026-09-01'), pill('нові', 2, '2027-01-01')], meds, today)
    expect(g.usable).toBe(2)
    expect(g.low).toBe(false)
  })

  it('рахує, скільки марок скоро зіпсується', () => {
    const [g] = groupItems([pill('а', 2, '2026-10-01'), pill('б', 2, null)], meds, today)
    expect(g.expiringSoon).toBe(1)
    expect(g.expired).toBe(0)
  })
})

describe('groupItems і різні одиниці', () => {
  it('дає розбивку за одиницями замість хибної суми', () => {
    const shampoo = [{ id: 's', name: 'шампунь', parent_id: 'r', threshold: 1 }]
    const [g] = groupItems([
      { id: '1', name: 'великий', qty: 500, category_id: 's', unit: 'мл' },
      { id: '2', name: 'дорожній', qty: 2, category_id: 's', unit: 'шт' },
    ], shampoo)
    expect(g.mixedUnits).toBe(true)
    expect(g.byUnit).toEqual([{ unit: 'мл', total: 500 }, { unit: 'шт', total: 2 }])
  })
})

describe('dominantUnit', () => {
  it('штучна одиниця важить більше за міру', () => {
    expect(dominantUnit([{ unit: 'мл' }, { unit: 'шт' }])).toBe('шт')
  })

  it('серед рівних — найчастіша', () => {
    expect(dominantUnit([{ unit: 'рулон' }, { unit: 'шт' }, { unit: 'рулон' }])).toBe('рулон')
  })

  it('лише міри — найчастіша з них', () => {
    expect(dominantUnit([{ unit: 'мл' }, { unit: 'г' }, { unit: 'мл' }])).toBe('мл')
  })
})
