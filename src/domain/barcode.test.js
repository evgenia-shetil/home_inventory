import { describe, it, expect } from 'vitest'
import { normalizeBarcode, isValidBarcode, findByBarcode } from './barcode.js'

describe('normalizeBarcode', () => {
  it('прибирає пробіли й дефіси зі сканів і ручного вводу', () => {
    expect(normalizeBarcode(' 4 820 024 700 016 ')).toBe('4820024700016')
    expect(normalizeBarcode('482-0024-700016')).toBe('4820024700016')
  })

  it('повертає порожнє для сміття', () => {
    expect(normalizeBarcode('абв')).toBe('')
    expect(normalizeBarcode(null)).toBe('')
  })
})

describe('isValidBarcode', () => {
  // Контрольна цифра EAN-13 рахується з перших дванадцяти.
  it('приймає коректний EAN-13', () => {
    expect(isValidBarcode('3017620422003')).toBe(true)
  })

  it('відхиляє EAN-13 з битою контрольною цифрою', () => {
    expect(isValidBarcode('3017620422004')).toBe(false)
  })

  it('приймає коректний EAN-8', () => {
    expect(isValidBarcode('96385074')).toBe(true)
  })

  it('відхиляє неправильну довжину', () => {
    expect(isValidBarcode('12345')).toBe(false)
    expect(isValidBarcode('')).toBe(false)
  })
})

describe('findByBarcode', () => {
  const items = [
    { id: 'a', name: 'Шампунь', barcode: '4820024700016' },
    { id: 'b', name: 'Порошок', barcode: null },
  ]

  it('знаходить товар за штрихкодом', () => {
    expect(findByBarcode(items, '4820024700016').id).toBe('a')
  })

  it('знаходить попри пробіли у введеному коді', () => {
    expect(findByBarcode(items, ' 4820 024 700016 ').id).toBe('a')
  })

  it('повертає null, коли збігу немає', () => {
    expect(findByBarcode(items, '0000000000000')).toBeNull()
  })

  it('не плутає товари без штрихкоду з порожнім запитом', () => {
    expect(findByBarcode(items, '')).toBeNull()
    expect(findByBarcode(items, null)).toBeNull()
  })
})
