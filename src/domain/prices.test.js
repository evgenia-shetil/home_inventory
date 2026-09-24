import { describe, it, expect } from 'vitest'
import { pricesByPlace, bestOffer, unitPrice } from './prices.js'

const restock = (item_id, price, place, created_at) =>
  ({ item_id, kind: 'restock', delta: 1, price, place, created_at })

describe('pricesByPlace', () => {
  it('для магазину бере останню ціну, а не першу', () => {
    const rows = pricesByPlace([
      restock('a', 100, 'АТБ', '2026-09-01'),
      restock('a', 120, 'АТБ', '2026-09-20'),
    ])
    expect(rows).toEqual([{ place: 'АТБ', price: 120, at: '2026-09-20', min: 100, count: 2 }])
  })

  it('сортує від дешевшого', () => {
    const rows = pricesByPlace([
      restock('a', 150, 'Сільпо', '2026-09-01'),
      restock('a', 90, 'АТБ', '2026-09-02'),
    ])
    expect(rows.map(r => r.place)).toEqual(['АТБ', 'Сільпо'])
  })

  it('пропускає витрати й поповнення без ціни', () => {
    const rows = pricesByPlace([
      { kind: 'consume', delta: -1, price: null },
      restock('a', null, 'АТБ', '2026-09-01'),
    ])
    expect(rows).toEqual([])
  })

  it('поповнення без магазину — окремий рядок без назви', () => {
    const rows = pricesByPlace([restock('a', 50, null, '2026-09-01'), restock('a', 60, '  ', '2026-09-02')])
    expect(rows).toHaveLength(1)
    expect(rows[0].place).toBeNull()
    expect(rows[0].price).toBe(60)
  })
})

describe('unitPrice', () => {
  it('ділить на фасування', () => {
    expect(unitPrice(100, { pack_size: 500, pack_unit: 'мл' })).toBeCloseTo(0.2)
  })

  it('без фасування відповіді немає', () => {
    expect(unitPrice(100, { pack_size: null })).toBeNull()
    expect(unitPrice(100, { pack_size: 0, pack_unit: 'мл' })).toBeNull()
  })
})

describe('bestOffer', () => {
  const group = items => ({ unit: 'шт', items })

  it('називає марку й магазин із найнижчою ціною', () => {
    const offer = bestOffer(
      group([{ id: 'a', name: 'Colgate', unit: 'шт' }, { id: 'b', name: 'Oral-B', unit: 'шт' }]),
      [restock('a', 80, 'АТБ', '2026-09-01'), restock('b', 60, 'Єва', '2026-09-02')],
    )
    expect(offer.item.name).toBe('Oral-B')
    expect(offer.place).toBe('Єва')
    expect(offer.alternatives).toBe(1)
    expect(offer.byVolume).toBe(false)
  })

  it('з відомим фасуванням порівнює за обʼємом', () => {
    const offer = bestOffer(
      group([
        { id: 'a', name: 'малий', unit: 'шт', pack_size: 250, pack_unit: 'мл' },
        { id: 'b', name: 'великий', unit: 'шт', pack_size: 1000, pack_unit: 'мл' },
      ]),
      [restock('a', 50, 'АТБ', '2026-09-01'), restock('b', 120, 'АТБ', '2026-09-01')],
    )
    expect(offer.item.name).toBe('великий')
    expect(offer.byVolume).toBe(true)
  })

  it('без цін — null', () => {
    expect(bestOffer(group([{ id: 'a', unit: 'шт' }]), [])).toBeNull()
  })

  it('не порівнює ціну кілограма з ціною штуки', () => {
    const offer = bestOffer(
      group([{ id: 'a', unit: 'кг' }, { id: 'b', unit: 'шт' }]),
      [restock('a', 10, 'АТБ', '2026-09-01'), restock('b', 50, 'АТБ', '2026-09-01')],
    )
    expect(offer.item.id).toBe('b')
  })
})
