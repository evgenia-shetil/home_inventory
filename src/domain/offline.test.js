import { describe, it, expect } from 'vitest'
import { isNetworkError, applyQueue } from './offline.js'

describe('isNetworkError', () => {
  it('упізнає обрив мережі в різних браузерах', () => {
    expect(isNetworkError({ message: 'TypeError: Failed to fetch' })).toBe(true)
    expect(isNetworkError({ message: 'TypeError: Load failed' })).toBe(true)
    expect(isNetworkError({ message: 'NetworkError when attempting to fetch resource.' })).toBe(true)
  })

  it('відмова сервера — не мережа, її не відкладаємо', () => {
    expect(isNetworkError({ message: 'товар не знайдено' })).toBe(false)
  })

  it('без мережі будь-яка помилка вважається мережевою', () => {
    expect(isNetworkError({ message: 'щось інше' }, false)).toBe(true)
  })
})

describe('applyQueue', () => {
  const items = [{ id: 'a', qty: 2 }, { id: 'b', qty: 0 }]

  it('накладає відкладені зміни запасу', () => {
    const next = applyQueue(items, [
      { itemId: 'a', delta: -1 },
      { itemId: 'b', delta: 3, extra: { bucket: 'stock' } },
    ])
    expect(next.map(i => i.qty)).toEqual([1, 3])
  })

  it('не опускає нижче нуля', () => {
    expect(applyQueue(items, [{ itemId: 'b', delta: -1 }])[1].qty).toBe(0)
  })

  it('перенесення не чіпає запас у шафі', () => {
    expect(applyQueue(items, [{ itemId: 'a', delta: 1, extra: { bucket: 'move' } }])[0].qty).toBe(2)
  })
})
