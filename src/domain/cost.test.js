import { describe, it, expect } from 'vitest'
import { estimateCost } from './cost.js'

const group = (items) => ({ items })

describe('estimateCost', () => {
  it('бере найдешевшу відому ціну в кожній групі', () => {
    const result = estimateCost([
      group([{ last_price: 150 }, { last_price: 90 }]),
      group([{ last_price: 40 }]),
    ])
    expect(result.total).toBe(130)
    expect(result.known).toBe(2)
    expect(result.unknown).toBe(0)
  })

  it('рахує, для скількох груп ціни немає', () => {
    const result = estimateCost([
      group([{ last_price: 100 }]),
      group([{ last_price: null }]),
      group([{}]),
    ])
    expect(result.total).toBe(100)
    expect(result.known).toBe(1)
    expect(result.unknown).toBe(2)
  })

  it('порожній список дає нулі', () => {
    expect(estimateCost([])).toEqual({ total: 0, known: 0, unknown: 0 })
  })
})
