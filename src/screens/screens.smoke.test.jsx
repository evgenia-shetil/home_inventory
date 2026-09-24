import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Димова перевірка екранів: лінт і збірка не бачать помилок виконання
// (звернення до поля undefined, хибна форма даних), а юніт-тести
// покривають лише чисту логіку. Тут кожен екран рендериться з
// правдоподібними даними, і падіння будь-якого з них ловиться до деплою.

const today = new Date()
const iso = days => new Date(today.getTime() + days * 86_400_000).toISOString()
const date = days => iso(days).slice(0, 10)

const fixtures = {
  categories: [
    { id: 'root', name: 'обличчя', parent_id: null, threshold: 1, target: null, sort_order: 1 },
    { id: 'meds', name: 'ліки', parent_id: 'root', threshold: 2, target: 4, sort_order: 2 },
    { id: 'wash', name: 'вмивання', parent_id: 'root', threshold: 1, target: null, sort_order: 3,
      usage_qty: 1, usage_months: 1 },
    { id: 'brush', name: 'зубна щітка', parent_id: 'root', threshold: 1, target: null, sort_order: 4,
      usage_qty: 1, usage_months: 3, scheduled: true, replaced_on: date(-100) },
  ],
  items: [
    { id: 'i1', name: 'Знеболювальне', qty: '3', in_use: '0', unit: 'шт', threshold: '1',
      category_id: 'meds', expires_on: date(-3), recurring: true, last_price: '80', last_place: 'АТБ',
      pack_size: null, pack_unit: null, updated_at: iso(-1), created_at: iso(-40) },
    { id: 'i2', name: 'Пінка', qty: '150', in_use: '0', unit: 'мл', threshold: '1',
      category_id: 'wash', expires_on: date(10), recurring: true, last_price: '0.5', last_place: null,
      pack_size: null, pack_unit: null, updated_at: iso(-2), created_at: iso(-40) },
    { id: 'i3', name: 'Гель', qty: '2', in_use: '1', unit: 'шт', threshold: '1',
      category_id: 'wash', expires_on: null, recurring: true, last_price: '120', last_place: 'Єва',
      pack_size: '250', pack_unit: 'мл', updated_at: iso(-2), created_at: iso(-40) },
    { id: 'i5', name: 'Oral-B', qty: '1', in_use: '1', unit: 'шт', threshold: '1',
      category_id: 'brush', expires_on: null, recurring: true, last_price: '145', last_place: 'Єва',
      pack_size: null, pack_unit: null, updated_at: iso(-3), created_at: iso(-40) },
    { id: 'i4', name: 'Лампочка', qty: '0', in_use: '0', unit: 'шт', threshold: '1',
      category_id: null, expires_on: null, recurring: false, last_price: null, last_place: null,
      pack_size: null, pack_unit: null, updated_at: iso(-5), created_at: iso(-40) },
  ],
  events: [
    { id: 'e1', item_id: 'i3', kind: 'restock', delta: '2', price: '120', place: 'Єва', bucket: 'stock', created_at: iso(-35) },
    { id: 'e2', item_id: 'i3', kind: 'restock', delta: '1', price: '99', place: 'АТБ', bucket: 'stock', created_at: iso(-30) },
    { id: 'e3', item_id: 'i3', kind: 'consume', delta: '-1', price: null, place: null, bucket: 'in_use', created_at: iso(-20) },
    { id: 'e4', item_id: 'i3', kind: 'consume', delta: '-1', price: null, place: null, bucket: 'in_use', created_at: iso(-10) },
    { id: 'e5', item_id: 'i3', kind: 'consume', delta: '-1', price: null, place: null, bucket: 'in_use', created_at: iso(-5) },
    { id: 'e6', item_id: 'i2', kind: 'unit', delta: '0', price: null, place: null, bucket: 'stock', note: '300 мл → 1 шт по 300 мл', created_at: iso(-4) },
  ],
}

function builder(table) {
  const result = { data: fixtures[table] ?? [], error: null }
  const chain = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then') return (resolve, reject) => Promise.resolve(result).then(resolve, reject)
      if (prop === 'single') return () => Promise.resolve({ data: result.data[0] ?? null, error: null })
      return () => chain
    },
  })
  return chain
}

vi.mock('../lib/supabase.js', () => ({
  supabase: {
    from: table => builder(table),
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'u' } } } }),
      signOut: () => Promise.resolve({ error: null }),
      updateUser: () => Promise.resolve({ error: null }),
    },
    storage: { from: () => ({ remove: () => Promise.resolve({}), upload: () => Promise.resolve({}) }) },
  },
}))

vi.mock('../lib/photos.js', () => ({
  usePhotoUrl: () => null,
  invalidatePhoto: () => {},
}))

const { InventoryProvider } = await import('../data/InventoryContext.jsx')
const screens = {
  StockScreen: (await import('./StockScreen.jsx')).default,
  ShoppingScreen: (await import('./ShoppingScreen.jsx')).default,
  ItemScreen: (await import('./ItemScreen.jsx')).default,
  CategoryScreen: (await import('./CategoryScreen.jsx')).default,
  ExpiryScreen: (await import('./ExpiryScreen.jsx')).default,
  UnsortedScreen: (await import('./UnsortedScreen.jsx')).default,
  NormsScreen: (await import('./NormsScreen.jsx')).default,
  SettingsScreen: (await import('./SettingsScreen.jsx')).default,
  AddItemScreen: (await import('./AddItemScreen.jsx')).default,
  SpendingScreen: (await import('./SpendingScreen.jsx')).default,
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container
let root

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function render(path, pattern, Screen, props = {}) {
  await act(async () => {
    root.render(
      <InventoryProvider userId="u">
        <MemoryRouter initialEntries={[path]}>
          <Routes><Route path={pattern} element={<Screen {...props} />} /></Routes>
        </MemoryRouter>
      </InventoryProvider>,
    )
  })
  // Завантаження йде кількома чергами промісів: категорії, дані, журнал.
  for (let i = 0; i < 5; i += 1) await act(async () => { await new Promise(r => setTimeout(r, 0)) })
  return container.textContent
}

describe('екрани рендеряться з реальною формою даних', () => {
  it('головна: плашка покупок, плитки категорій і рядок термінів', async () => {
    const text = await render('/', '/', screens.StockScreen)
    expect(text).toMatch(/1\s*потреба у покупках/)
    expect(text).toContain('Термін придатності')
    expect(text).toContain('обличчя')
    expect(text).toContain('прострочено 1')
    expect(text).toContain('Без категорії')
    // Потреби видно на плитці, а не переліком усіх підкатегорій.
    expect(text).not.toContain('вмивання')
  })

  it('головна категорія — перелік її потреб з розбивкою одиниць', async () => {
    const text = await render('/category/root', '/category/:id', screens.CategoryScreen)
    expect(text).toContain('ліки')
    expect(text).toContain('вмивання')
    expect(text).toMatch(/150 мл \+ 3 шт/)
  })

  it('покупки: прострочене не рахується як запас, разова річ не потрапляє', async () => {
    const text = await render('/shopping', '/shopping', screens.ShoppingScreen)
    expect(text).toContain('ліки')
    expect(text).toContain('прострочено')
    expect(text).not.toContain('Лампочка')
  })

  it('заміна за графіком на головній', async () => {
    const text = await render('/', '/', screens.StockScreen)
    expect(text).toContain('Заміна: зубна щітка')
    expect(text).toContain('Замінено')
  })

  it('план закупівлі на рік', async () => {
    // Node підставляє власний неповний localStorage замість jsdom-ового,
    // тож обраний період задаємо заглушкою.
    vi.stubGlobal('localStorage', {
      getItem: key => (key === 'zapasy:horizon' ? '12' : null),
      setItem: () => {}, removeItem: () => {},
    })
    try {
      const text = await render('/shopping', '/shopping', screens.ShoppingScreen)
      expect(text).toContain('за нормою')
      expect(text).toMatch(/4\s*заміни за період/)
      expect(text).toContain('Темп невідомий')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('налаштування підкатегорії з нормою й графіком', async () => {
    const text = await render('/category/brush', '/category/:id', screens.CategoryScreen)
    expect(text).toContain('наступна заміна')
  })

  it('картка простроченого товару пропонує списання', async () => {
    const text = await render('/item/i1', '/item/:id', screens.ItemScreen)
    expect(text).toContain('Термін придатності минув')
    expect(text).toContain('Списати')
  })

  it('картка товару в мілілітрах пропонує рахувати упаковками', async () => {
    const text = await render('/item/i2', '/item/:id', screens.ItemScreen)
    expect(text).toContain('Рахувати упаковками')
    expect(text).toContain('зміна одиниці')
  })

  it('картка з фасуванням і цінами в кількох магазинах', async () => {
    const text = await render('/item/i3', '/item/:id', screens.ItemScreen)
    expect(text).toContain('Фасування')
    expect(text).toContain('Ціни за магазинами')
  })

  it('екран категорії', async () => {
    const text = await render('/category/wash', '/category/:id', screens.CategoryScreen)
    expect(text).toContain('вмивання')
    expect(text).toContain('Різні одиниці')
    expect(text).not.toContain('мл у користуванні')
  })

  it('погляд «Термін придатності»', async () => {
    const text = await render('/expiring', '/expiring', screens.ExpiryScreen)
    expect(text).toContain('Прострочено')
    expect(text).toContain('Знеболювальне')
    expect(text).toContain('Пінка')
  })

  it('«Ще» з резервною копією', async () => {
    const text = await render('/settings', '/settings', screens.SettingsScreen, { email: 'a@b.c' })
    expect(text).toContain('Резервна копія')
    expect(text).toContain('Зберегти копію')
  })

  it('форма нового товару', async () => {
    const text = await render('/add', '/add', screens.AddItemScreen)
    expect(text).toContain('Фасування')
    expect(text).toContain('Придатний до')
  })

  it('норми всіх підкатегорій одним списком', async () => {
    const text = await render('/norms', '/norms', screens.NormsScreen)
    expect(text).toContain('Норми')
    expect(text).toContain('зубна щітка')
    expect(text).toMatch(/1\s*підкатегорія без норми/)
  })

  it('нерозкладене', async () => {
    const text = await render('/unsorted', '/unsorted', screens.UnsortedScreen)
    expect(text).toContain('Лампочка')
  })

  it('витрати', async () => {
    const text = await render('/spending', '/spending', screens.SpendingScreen)
    expect(text).toContain('Витрати')
  })
})
