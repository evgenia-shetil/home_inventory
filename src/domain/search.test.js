import { describe, it, expect } from 'vitest'
import { searchItems, searchCategories } from './search.js'

const items = [
  { id: '1', name: 'Exfoliating tonic Biotrade' },
  { id: '2', name: 'Спрей антиміль' },
  { id: '3', name: 'Тонік для обличчя' },
]

describe('searchItems', () => {
  it('порожній запит повертає все', () => {
    expect(searchItems(items, '')).toHaveLength(3)
    expect(searchItems(items, '   ')).toHaveLength(3)
  })

  it('шукає частину слова', () => {
    expect(searchItems(items, 'тонік').map(i => i.id)).toEqual(['3'])
  })

  it('не зважає на регістр', () => {
    expect(searchItems(items, 'TONIC').map(i => i.id)).toEqual(['1'])
  })

  it('знаходить за кількома словами в будь-якому порядку', () => {
    expect(searchItems(items, 'biotrade exfoliating').map(i => i.id)).toEqual(['1'])
  })

  it('порожній результат, коли нічого не збіглось', () => {
    expect(searchItems(items, 'шампунь')).toEqual([])
  })
})

describe('searchCategories', () => {
  const cats = [
    { id: 'face', name: 'обличчя', parent_id: null },
    { id: 'paste', name: 'зубна паста', parent_id: 'face' },
    { id: 'brush', name: 'зубна щітка', parent_id: 'face' },
    { id: 'teeth', name: 'зуби', parent_id: null },
  ]

  it('знаходить підкатегорію за частиною слова', () => {
    expect(searchCategories(cats, 'паст').map(c => c.id)).toEqual(['paste'])
  })

  it('підкатегорії попереду головних', () => {
    expect(searchCategories(cats, 'зуб').map(c => c.id)).toEqual(['paste', 'brush', 'teeth'])
  })

  it('порожній запит — нічого', () => {
    expect(searchCategories(cats, '  ')).toEqual([])
  })
})
