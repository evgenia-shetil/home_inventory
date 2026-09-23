import { describe, it, expect } from 'vitest'
import { lookupProduct, composeName } from './lookup.js'

const ok = product => ({ ok: true, json: async () => ({ status: 1, product }) })
const missing = { ok: true, json: async () => ({ status: 0 }) }

// Підставний fetch: віддає відповідь залежно від того, яка база в URL
const fakeFetch = responses => async url => {
  const db = Object.keys(responses).find(key => url.includes(key))
  const answer = db ? responses[db] : missing
  if (answer instanceof Error) throw answer
  return answer
}

describe('composeName', () => {
  it('додає бренд попереду назви', () => {
    expect(composeName('Nivea', 'Крем для рук')).toBe('Nivea Крем для рук')
  })

  it('не дублює бренд, якщо він уже в назві', () => {
    expect(composeName('Nivea', 'Nivea Soft')).toBe('Nivea Soft')
  })

  it('не зважає на регістр при перевірці дубля', () => {
    expect(composeName('NIVEA', 'nivea soft')).toBe('nivea soft')
  })

  it('працює без бренду', () => {
    expect(composeName('', 'Порошок')).toBe('Порошок')
    expect(composeName(null, 'Порошок')).toBe('Порошок')
  })

  it('бере лише перший бренд зі списку через кому', () => {
    expect(composeName('Nivea, Beiersdorf', 'Крем')).toBe('Nivea Крем')
  })
})

describe('lookupProduct', () => {
  it('знаходить у базі косметики', async () => {
    const result = await lookupProduct('3017620422003', fakeFetch({
      openbeautyfacts: ok({ product_name: 'Крем', brands: 'Nivea', image_url: 'http://i/1.jpg' }),
    }))
    expect(result).toEqual({
      name: 'Nivea Крем', imageUrl: 'http://i/1.jpg', source: 'openbeautyfacts',
    })
  })

  it('переходить до наступної бази, якщо в попередній немає', async () => {
    const result = await lookupProduct('3017620422003', fakeFetch({
      openfoodfacts: ok({ product_name: 'Nutella', brands: 'Ferrero', image_url: 'http://i/2.jpg' }),
    }))
    expect(result.name).toBe('Ferrero Nutella')
    expect(result.source).toBe('openfoodfacts')
  })

  it('повертає null, коли ніде немає', async () => {
    expect(await lookupProduct('3017620422003', fakeFetch({}))).toBeNull()
  })

  it('не падає, коли одна з баз недоступна', async () => {
    const result = await lookupProduct('3017620422003', fakeFetch({
      openbeautyfacts: new Error('мережа'),
      openfoodfacts: ok({ product_name: 'Nutella', brands: '', image_url: null }),
    }))
    expect(result.name).toBe('Nutella')
    expect(result.imageUrl).toBeNull()
  })

  it('ігнорує знахідку без назви', async () => {
    const result = await lookupProduct('3017620422003', fakeFetch({
      openbeautyfacts: ok({ product_name: '', brands: 'Nivea' }),
    }))
    expect(result).toBeNull()
  })

  it('не ходить у мережу з невалідним кодом', async () => {
    let called = false
    await lookupProduct('123', async () => { called = true; return missing })
    expect(called).toBe(false)
  })
})
