import { describe, it, expect } from 'vitest'
import { collectPlaces } from './places.js'

describe('collectPlaces', () => {
  it('віддає стартові магазини, коли товарів ще немає', () => {
    expect(collectPlaces([])).toContain('Нотіно')
    expect(collectPlaces([])).toContain('EVA')
    expect(collectPlaces([])).toContain('MAKEUP')
  })

  it('додає магазини з уже введених товарів', () => {
    expect(collectPlaces([{ last_place: 'Ашан' }])).toContain('Ашан')
  })

  it('не дублює те, що вже є у стартовому списку', () => {
    const list = collectPlaces([{ last_place: 'EVA' }])
    expect(list.filter(p => p === 'EVA')).toHaveLength(1)
  })

  it('не зважає на регістр і пробіли при пошуку дублів', () => {
    const list = collectPlaces([{ last_place: ' eva ' }, { last_place: 'Eva' }])
    expect(list.filter(p => p.toLowerCase().trim() === 'eva')).toHaveLength(1)
  })

  it('пропускає порожні значення', () => {
    const list = collectPlaces([{ last_place: null }, { last_place: '' }, { last_place: '  ' }])
    expect(list).not.toContain('')
    expect(list).not.toContain(null)
  })

  it('сортує за абеткою, щоб порядок не стрибав', () => {
    const list = collectPlaces([{ last_place: 'Аптека' }, { last_place: 'Ашан' }])
    expect(list.indexOf('Аптека')).toBeLessThan(list.indexOf('Ашан'))
  })
})
