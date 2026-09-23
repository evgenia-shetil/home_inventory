import { describe, it, expect } from 'vitest'
import { planAutoSort } from './autosort.js'

const tree = [
  { id: 'r', name: 'обличчя', parent_id: null },
  { id: 'c', name: 'зубна щітка', parent_id: 'r' },
  { id: 'r2', name: 'тіло', parent_id: null },
]

describe('planAutoSort', () => {
  it('пропонує підкатегорію товарам, що висять на головній', () => {
    const plan = planAutoSort([{ id: '1', name: 'Jordan зубна щітка', category_id: 'r' }], tree)
    expect(plan).toEqual([{ id: '1', name: 'Jordan зубна щітка', categoryId: 'c' }])
  })

  it('бере й товари взагалі без категорії', () => {
    const plan = planAutoSort([{ id: '1', name: 'зубні щітки', category_id: null }], tree)
    expect(plan[0].categoryId).toBe('c')
  })

  it('не чіпає те, що вже лежить у підкатегорії', () => {
    expect(planAutoSort([{ id: '1', name: 'зубна щітка', category_id: 'c' }], tree)).toEqual([])
  })

  it('мовчить, коли впізнати не вдалось', () => {
    expect(planAutoSort([{ id: '1', name: 'щось дивне', category_id: null }], tree)).toEqual([])
  })

  // Здогад без підкатегорії нічого не дає: товар і так висить на корені.
  it('не пропонує переносити на головну категорію', () => {
    const noChild = tree.filter(c => c.id !== 'c')
    expect(planAutoSort([{ id: '1', name: 'зубна щітка', category_id: 'r' }], noChild)).toEqual([])
  })
})
