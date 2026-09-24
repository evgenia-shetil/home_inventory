import { describe, it, expect } from 'vitest'
import { rootSummaries, unsortedItems, branchItems } from './home.js'
import { isNeed } from './needs.js'

const cats = [
  { id: 'face', name: 'обличчя', parent_id: null },
  { id: 'paste', name: 'зубна паста', parent_id: 'face', threshold: 1 },
  { id: 'cream', name: 'крем', parent_id: 'face', threshold: 1 },
  { id: 'home', name: 'дім', parent_id: null },
  { id: 'lamp', name: 'лампочки', parent_id: 'home', threshold: 1 },
  { id: 'empty', name: 'порожня', parent_id: null },
]
const item = (id, category_id, qty, extra = {}) =>
  ({ id, name: id, category_id, qty, in_use: 0, unit: 'шт', threshold: 1, ...extra })

describe('rootSummaries', () => {
  const items = [
    item('colgate', 'paste', 0),
    item('nivea', 'cream', 5, { expires_on: '2020-01-01' }),
    item('e27', 'lamp', 0, { recurring: false }),
  ]
  const [face, home, empty] = rootSummaries(items, cats, '2026-09-24')

  it('рахує потреби й прострочене в гілці', () => {
    expect(face).toMatchObject({ groups: 2, needs: 2, expired: 1 })
  })

  it('разова річ не є потребою', () => {
    expect(home).toMatchObject({ groups: 1, needs: 0 })
  })

  it('порожня категорія теж має плитку', () => {
    expect(empty).toMatchObject({ groups: 0, needs: 0 })
  })
})

describe('unsortedItems', () => {
  it('без категорії й причеплене до головної з підкатегоріями', () => {
    const items = [item('a', null, 1), item('b', 'face', 1), item('c', 'paste', 1), item('d', 'empty', 1)]
    expect(unsortedItems(items, cats).map(i => i.id)).toEqual(['a', 'b'])
  })
})

describe('branchItems', () => {
  it('бере товари головної й усіх її підкатегорій', () => {
    const items = [item('a', 'face', 1), item('b', 'paste', 1), item('c', 'lamp', 1)]
    expect(branchItems('face', items, cats).map(i => i.id)).toEqual(['a', 'b'])
  })
})

describe('isNeed', () => {
  it('низька група з поновлюваним товаром', () => {
    expect(isNeed({ low: true, items: [{ recurring: true }] })).toBe(true)
    expect(isNeed({ low: true, items: [{ recurring: false }] })).toBe(false)
    expect(isNeed({ low: false, items: [{}] })).toBe(false)
  })
})
