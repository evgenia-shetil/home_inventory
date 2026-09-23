import { describe, it, expect } from 'vitest'
import { suggestCategory } from './suggest.js'

// Дерево у тому вигляді, в якому воно приходить з бази
const cats = [
  { id: 'r1', name: 'тіло', parent_id: null },
  { id: 'c1', name: 'шампунь', parent_id: 'r1' },
  { id: 'c2', name: 'крем для тіла', parent_id: 'r1' },
  { id: 'r2', name: 'обличчя', parent_id: null },
  { id: 'c3', name: 'крем для обличчя', parent_id: 'r2' },
  { id: 'r3', name: 'ліки', parent_id: null },
  { id: 'c4', name: 'вітаміни', parent_id: 'r3' },
]

describe('suggestCategory', () => {
  it('упізнає підкатегорію за словом у назві', () => {
    expect(suggestCategory('Head & Shoulders шампунь 400 мл', cats))
      .toEqual({ rootId: 'r1', childId: 'c1' })
  })

  it('не зважає на регістр', () => {
    expect(suggestCategory('ШАМПУНЬ для волосся', cats).childId).toBe('c1')
  })

  it('розрізняє крем для обличчя і для тіла', () => {
    expect(suggestCategory('Nivea крем для тіла', cats).childId).toBe('c2')
    expect(suggestCategory('нічний крем для обличчя', cats).childId).toBe('c3')
  })

  // «крем для обличчя» містить у собі «крем», тож коротший збіг
  // не має перемагати довший.
  it('обирає найточніший збіг, а не найперший', () => {
    expect(suggestCategory('крем для обличчя денний', cats).childId).toBe('c3')
  })

  it('впізнає ліки за назвою препарату', () => {
    expect(suggestCategory('Вітамін D3 2000 МО', cats).childId).toBe('c4')
  })

  it('повертає порожнє, коли нічого не впізнав', () => {
    expect(suggestCategory('щось незрозуміле', cats)).toEqual({ rootId: null, childId: null })
  })

  it('не падає на порожній назві чи порожньому дереві', () => {
    expect(suggestCategory('', cats)).toEqual({ rootId: null, childId: null })
    expect(suggestCategory('шампунь', [])).toEqual({ rootId: null, childId: null })
  })

  // Підкатегорії міг видалити користувач — тоді підказуємо хоча б корінь.
  it('підказує корінь, якщо потрібної підкатегорії вже немає', () => {
    const trimmed = cats.filter(c => c.id !== 'c1')
    expect(suggestCategory('шампунь', trimmed)).toEqual({ rootId: 'r1', childId: null })
  })
})
