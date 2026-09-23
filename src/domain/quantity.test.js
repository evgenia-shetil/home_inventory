import { describe, it, expect } from 'vitest'
import { stepQty, parseQty } from './quantity.js'

describe('parseQty', () => {
  it('читає число з рядка', () => {
    expect(parseQty('3')).toBe(3)
    expect(parseQty('1.5')).toBe(1.5)
  })

  it('приймає кому як роздільник — так набирають з телефона', () => {
    expect(parseQty('1,5')).toBe(1.5)
  })

  it('порожнє й сміття дають нуль', () => {
    expect(parseQty('')).toBe(0)
    expect(parseQty('абв')).toBe(0)
    expect(parseQty(null)).toBe(0)
  })
})

describe('stepQty', () => {
  it('додає і віднімає одиницю', () => {
    expect(stepQty('3', 1)).toBe('4')
    expect(stepQty('3', -1)).toBe('2')
  })

  it('не опускається нижче нуля', () => {
    expect(stepQty('0', -1)).toBe('0')
    expect(stepQty('0.5', -1)).toBe('0')
  })

  it('не ламає дробові значення', () => {
    expect(stepQty('1.5', 1)).toBe('2.5')
  })

  // 0.1 + 0.2 у подвійній точності дає 0.30000000000000004 —
  // у полі вводу таке показувати не можна.
  it('не породжує хвіст з плаваючої коми', () => {
    expect(stepQty('0.1', 0.2)).toBe('0.3')
  })

  it('порожнє поле поводиться як нуль', () => {
    expect(stepQty('', 1)).toBe('1')
    expect(stepQty('', -1)).toBe('0')
  })
})

describe('correctionDelta', () => {
  it('рахує, скільки додати чи відняти до потрібного числа', async () => {
    const { correctionDelta } = await import('./quantity.js')
    expect(correctionDelta(7, '3')).toBe(-4)
    expect(correctionDelta(1, '5')).toBe(4)
  })

  it('нуль, коли нічого не змінилось', async () => {
    const { correctionDelta } = await import('./quantity.js')
    expect(correctionDelta(3, '3')).toBe(0)
  })

  it('розуміє кому і порожнє поле', async () => {
    const { correctionDelta } = await import('./quantity.js')
    expect(correctionDelta(1, '2,5')).toBe(1.5)
    expect(correctionDelta(2, '')).toBe(-2)
  })
})
