import { describe, it, expect } from 'vitest'
import { formatQty, formatPrice, formatTotal } from './format.js'

describe('formatQty', () => {
  it('прибирає зайві нулі у цілих числах', () => {
    expect(formatQty(3, 'шт')).toBe('3 шт')
    expect(formatQty('3.00', 'шт')).toBe('3 шт')
  })

  it('лишає дробову частину, коли вона значуща', () => {
    expect(formatQty(1.5, 'кг')).toBe('1,5 кг')
  })
})

describe('formatPrice', () => {
  it('форматує з копійками і гривнею', () => {
    expect(formatPrice(42.5)).toBe('42,50 грн')
  })

  it('повертає риску, коли ціни немає', () => {
    expect(formatPrice(null)).toBe('—')
    expect(formatPrice(undefined)).toBe('—')
  })
})

describe('formatTotal', () => {
  it('множить кількість на ціну', () => {
    expect(formatTotal(3, 10)).toBe('30,00 грн')
  })

  it('повертає риску без ціни', () => {
    expect(formatTotal(3, null)).toBe('—')
  })
})
