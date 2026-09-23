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

describe('догляд за ротом', () => {
  const oral = [
    { id: 'f', name: 'обличчя', parent_id: null },
    { id: 'p', name: 'зубна паста', parent_id: 'f' },
    { id: 'b', name: 'зубна щітка', parent_id: 'f' },
  ]

  it('паста і щітка належать до обличчя, а не до тіла', () => {
    expect(suggestCategory('Curaprox Enzycal зубна паста', oral))
      .toEqual({ rootId: 'f', childId: 'p' })
    expect(suggestCategory('Jordan зубна щітка Medium', oral))
      .toEqual({ rootId: 'f', childId: 'b' })
  })
})

// Справжній асортимент користувачки. Кожен рядок — товар, який раніше
// лишався без підкатегорії.
describe('реальні товари', () => {
  const tree = []
  const add = (name, parent = null) => {
    const id = parent ? `${parent}/${name}` : name
    tree.push({ id, name, parent_id: parent })
    return id
  }
  const roots = ['прибирання', 'тіло', 'обличчя', 'ліки', 'побут']
  roots.forEach(r => add(r))
  const kids = {
    'прибирання': ['чистячі', 'губки', 'від комах', 'освіжувачі'],
    'тіло': ['шампунь', 'бритви', 'засмага', 'сонцезахист', 'манікюр', 'гігієна', 'олії'],
    'обличчя': ['очищення', 'тонік', 'сонцезахист', 'зубна паста', 'зубна щітка', 'брови і вії'],
    'ліки': ['знеболювальні'],
    'побут': ['лампочки', 'фільтри'],
  }
  Object.entries(kids).forEach(([r, list]) => list.forEach(c => add(c, r)))

  const expectPath = (name, root, child) => {
    const got = suggestCategory(name, tree)
    expect({ root: got.rootId, child: got.childId }).toEqual({ root, child: `${root}/${child}` })
  }

  it.each([
    ['Ceraprox ultra soft 5460', 'обличчя', 'зубна щітка'],
    ['Jordan clean smile Soft', 'обличчя', 'зубна щітка'],
    ['Jordan total clean Medium', 'обличчя', 'зубна щітка'],
    ['Philips SonicCare W', 'обличчя', 'зубна щітка'],
    ['Зубні щітки гостьові', 'обличчя', 'зубна щітка'],
    ['Curaprox Enzycal', 'обличчя', 'зубна паста'],
    ['Cleansing oil ma:nyo', 'обличчя', 'очищення'],
    ['Exfoliating tonic Biotrade', 'обличчя', 'тонік'],
    ['Гель для укладанні брів', 'обличчя', 'брови і вії'],
    ['Спф для обличча', 'обличчя', 'сонцезахист'],
    ['СПФ для тіла', 'тіло', 'сонцезахист'],
    ['Автозасмага крем-флюїд About sun Bronz Tan', 'тіло', 'засмага'],
    ['Мус Автозасмага Dove від середнього до темного', 'тіло', 'засмага'],
    ['Гель для гоління Gillette', 'тіло', 'бритви'],
    ['Засіб для зняття лану Ноготок', 'тіло', 'манікюр'],
    ['Ватні палички Lady Cotton', 'тіло', 'гігієна'],
    ['Тальк', 'тіло', 'гігієна'],
    ['Олія Мигдальна', 'тіло', 'олії'],
    ['Знеболювальний крем', 'ліки', 'знеболювальні'],
    ['Знеболювальний крем b-Caine cream', 'ліки', 'знеболювальні'],
    ['Засіб для чищення труб Tiret', 'прибирання', 'чистячі'],
    ['Поліроль антипил Pronto', 'прибирання', 'чистячі'],
    ['Липкий рол від шерсті', 'прибирання', 'губки'],
    ['Липучки проти харчової молі VACO', 'прибирання', 'від комах'],
    ['Пластинки проти комарів irrx', 'прибирання', 'від комах'],
    ['Рідина проти комарів Mosquitall', 'прибирання', 'від комах'],
    ['Спрей антиміль', 'прибирання', 'від комах'],
    ['Освіжувач повітря Ніжність шовку AirWick', 'прибирання', 'освіжувачі'],
    ['Лампочка Led 20w', 'побут', 'лампочки'],
    ['Картридж для фільтра води', 'побут', 'фільтри'],
  ])('%s', (name, root, child) => expectPath(name, root, child))

  // Бренд Curaprox робить і щітки, і пасту — за ним розрізнити не можна,
  // тому в словнику його немає взагалі.
  it('не плутає пасту зі щіткою того самого бренду', () => {
    expect(suggestCategory('Curaprox Enzycal', tree).childId).toBe('обличчя/зубна паста')
    expect(suggestCategory('Ceraprox ultra soft 5460', tree).childId).toBe('обличчя/зубна щітка')
  })
})
