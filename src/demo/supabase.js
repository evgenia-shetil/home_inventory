// Демо-режим для перевірки інтерфейсу без входу: `npm run dev:demo`.
// Підміняє справжній клієнт Supabase базою в памʼяті (див. vite.config.js).
// У прод-збірку не потрапляє: підміна вмикається лише в режимі demo.
//
// Навіщо: перевіряти екрани очима, не вводячи пароль і не чіпаючи
// живих даних. Підтримує рівно ту частину API, якою користується застосунок.
const USER = { id: 'demo-user', email: 'demo@zapasy.local' }
const now = Date.now()
const iso = days => new Date(now + days * 86_400_000).toISOString()
const day = days => iso(days).slice(0, 10)
let seq = 0
const id = () => `demo-${++seq}`

const cat = (name, parent_id = null, extra = {}) =>
  ({ id: id(), user_id: USER.id, name, parent_id, threshold: 1, target: null, usage_qty: null,
     usage_months: null, scheduled: false, replaced_on: null, sort_order: seq, created_at: iso(-60), ...extra })

const face = cat('обличчя')
const body = cat('тіло')
const meds = cat('ліки')
const home = cat('дім')
const cats = [
  face, body, meds, home,
  cat('зубна паста', face.id, { threshold: 1, target: 3, usage_qty: 1, usage_months: 1 }),
  cat('зубна щітка', face.id, { threshold: 1, usage_qty: 1, usage_months: 3, scheduled: true, replaced_on: day(-89) }),
  cat('крем', face.id),
  cat('шампунь', body.id, { threshold: 1, target: 2, usage_qty: 1, usage_months: 2 }),
  cat('гель для душу', body.id),
  cat('дезодорант', body.id),
  cat('знеболювальне', meds.id, { threshold: 2 }),
  cat('пластирі', meds.id),
  cat('миючий засіб', home.id),
  cat('туалетний папір', home.id, { threshold: 4, target: 12, usage_qty: 8, usage_months: 1 }),
  cat('лампочки', home.id),
]
const sub = name => cats.find(c => c.name === name).id

const item = (name, category, fields = {}) => ({
  id: id(), user_id: USER.id, name, category_id: category ? sub(category) : null,
  photo_path: null, qty: 1, in_use: 0, unit: 'шт', threshold: 1, last_price: null,
  last_place: null, barcode: null, recurring: true, expires_on: null,
  pack_size: null, pack_unit: null, created_at: iso(-50), updated_at: iso(-2), ...fields,
})

const items = [
  item('Colgate Total', 'зубна паста', { qty: 0, in_use: 1, last_price: 89, last_place: 'АТБ' }),
  item('Splat Professional', 'зубна паста', { qty: 1, last_price: 112, last_place: 'Єва' }),
  item('Oral-B Pro Expert', 'зубна щітка', { qty: 1, in_use: 1, last_price: 145, last_place: 'Єва' }),
  item('La Roche-Posay Toleriane', 'крем', { qty: 1, last_price: 780, last_place: 'Нотіно', expires_on: day(12) }),
  item('Head & Shoulders', 'шампунь', { qty: 2, in_use: 1, last_price: 210, last_place: 'Сільпо', pack_size: 400, pack_unit: 'мл' }),
  item('Шампунь дорожній', 'шампунь', { qty: 150, unit: 'мл' }),
  item('Dove гель', 'гель для душу', { qty: 0, in_use: 1, last_price: 135, last_place: 'АТБ' }),
  item('Rexona', 'дезодорант', { qty: 3, last_price: 99, last_place: 'АТБ' }),
  item('Ібупрофен 200 мг', 'знеболювальне', { qty: 2, expires_on: day(-6), last_price: 64, last_place: 'Аптека' }),
  item('Парацетамол', 'знеболювальне', { qty: 1, expires_on: day(200), last_price: 38, last_place: 'Аптека' }),
  item('Пластирі Hansaplast', 'пластирі', { qty: 1 }),
  item('Fairy', 'миючий засіб', { qty: 1, in_use: 1, last_price: 95, last_place: 'Сільпо' }),
  item('Zewa Deluxe', 'туалетний папір', { qty: 3, unit: 'рулон', last_price: 28, last_place: 'АТБ' }),
  item('Лампочка E27', 'лампочки', { qty: 0, recurring: false }),
  item('Батарейки AA', null, { qty: 4 }),
]

const ev = (it, kind, delta, days, extra = {}) =>
  ({ id: id(), user_id: USER.id, item_id: it.id, kind, delta, bucket: 'stock', price: null, place: null, note: null, created_at: iso(days), ...extra })
const byName = n => items.find(i => i.name === n)
const events = [
  ev(byName('Head & Shoulders'), 'restock', 3, -40, { price: 230, place: 'АТБ' }),
  ev(byName('Head & Shoulders'), 'restock', 1, -20, { price: 210, place: 'Сільпо' }),
  ev(byName('Zewa Deluxe'), 'restock', 12, -45, { price: 28, place: 'АТБ' }),
  ...[-40, -35, -30, -26, -22, -18, -14, -10, -6].map(d => ev(byName('Zewa Deluxe'), 'consume', -1, d)),
  ev(byName('Colgate Total'), 'restock', 2, -30, { price: 89, place: 'АТБ' }),
  ev(byName('Splat Professional'), 'restock', 1, -25, { price: 112, place: 'Єва' }),
]

const db = { categories: cats, items, events }

// Мінімальний конструктор запитів у стилі postgrest-js.
function query(table) {
  let rows = null
  let op = 'select'
  let payload = null
  const filters = []
  let order = null
  let limit = null
  let range = null
  let single = false

  const run = () => {
    const match = r => filters.every(f => f(r))
    if (op === 'insert') {
      const row = { id: id(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), parent_id: null, ...payload }
      db[table].push(row)
      rows = [row]
    } else if (op === 'update') {
      rows = db[table].filter(match)
      rows.forEach(r => Object.assign(r, payload, table === 'items' ? { updated_at: new Date().toISOString() } : {}))
    } else if (op === 'delete') {
      const gone = db[table].filter(match)
      db[table] = db[table].filter(r => !match(r))
      if (table === 'categories') {
        const ids = new Set(gone.map(g => g.id))
        db.categories = db.categories.filter(c => !ids.has(c.parent_id))
        db.items.forEach(i => { if (ids.has(i.category_id)) i.category_id = null })
      }
      rows = []
    } else {
      rows = db[table].filter(match)
    }
    rows = rows.map(r => ({ ...r }))
    if (order) rows.sort((a, b) => (String(a[order.col]) > String(b[order.col]) ? 1 : -1) * (order.asc ? 1 : -1))
    if (range) rows = rows.slice(range[0], range[1] + 1)
    if (limit) rows = rows.slice(0, limit)
    return { data: single ? rows[0] ?? null : rows, error: null }
  }

  const chain = {
    select: () => chain,
    insert: p => { op = 'insert'; payload = p; return chain },
    update: p => { op = 'update'; payload = p; return chain },
    delete: () => { op = 'delete'; return chain },
    eq: (c, v) => { filters.push(r => r[c] === v); return chain },
    in: (c, vs) => { filters.push(r => vs.includes(r[c])); return chain },
    gte: (c, v) => { filters.push(r => String(r[c]) >= String(v)); return chain },
    not: (c, _op, v) => { filters.push(r => (v === null ? r[c] !== null && r[c] !== undefined : r[c] !== v)); return chain },
    order: (col, o = {}) => { order = { col, asc: o.ascending !== false }; return chain },
    limit: n => { limit = n; return chain },
    range: (a, b) => { range = [a, b]; return chain },
    single: () => { single = true; return Promise.resolve(run()) },
    then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
  }
  return chain
}

function adjust({ p_item_id, p_delta, p_kind, p_price, p_place, p_bucket = 'stock' }) {
  const it = db.items.find(i => i.id === p_item_id)
  if (!it) return { data: null, error: { message: 'товар не знайдено' } }
  let applied
  if (p_bucket === 'stock') { const n = Math.max(0, it.qty + p_delta); applied = n - it.qty; it.qty = n }
  else if (p_bucket === 'in_use') { const n = Math.max(0, it.in_use + p_delta); applied = n - it.in_use; it.in_use = n }
  else {
    applied = p_delta < 0 ? Math.max(p_delta, -it.in_use) : Math.min(p_delta, it.qty)
    it.qty -= applied; it.in_use += applied
  }
  if (p_price !== null && p_price !== undefined) it.last_price = p_price
  if (p_place) it.last_place = p_place
  it.updated_at = new Date().toISOString()
  db.events.push({ id: id(), user_id: USER.id, item_id: it.id, delta: applied, kind: p_kind, bucket: p_bucket, price: p_price ?? null, place: p_place ?? null, note: null, created_at: it.updated_at })
  return { data: { ...it }, error: null }
}

const session = { user: USER, access_token: 'demo', expires_at: Math.floor(now / 1000) + 86_400 }
const delay = value => new Promise(r => setTimeout(() => r(value), 150))

export const supabase = {
  from: table => query(table),
  rpc: (name, args) => {
    if (name === 'adjust_quantity') return delay(adjust(args))
    if (name === 'journal_mismatches') return delay({ data: [], error: null })
    return delay({ data: null, error: null })
  },
  auth: {
    getSession: () => Promise.resolve({ data: { session } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: () => Promise.resolve({ error: null }),
    updateUser: () => Promise.resolve({ error: null }),
    signInWithPassword: () => Promise.resolve({ error: null }),
  },
  storage: {
    from: () => ({
      createSignedUrl: () => Promise.resolve({ data: null, error: { message: 'demo' } }),
      remove: () => Promise.resolve({}),
      upload: () => Promise.resolve({ error: null }),
    }),
  },
}
