// Порівняння цін будується з того, що вже є: кожне поповнення з ціною
// зберігає і суму, і місце. Нового введення не потрібно.
//
// Для кожного магазину береться ОСТАННЯ ціна, а не середня: ціни
// міняються, і те, що було дешевим пів року тому, нічого не каже
// про сьогодні. Найнижча за весь час показується окремо, як довідка.
const NO_PLACE = ''

const priced = e =>
  e.kind === 'restock' && e.price !== null && e.price !== undefined && e.price !== ''

export function pricesByPlace(events = []) {
  const places = new Map()

  for (const e of events) {
    if (!priced(e)) continue
    const key = (e.place ?? '').trim() || NO_PLACE
    const price = Number(e.price)
    const entry = places.get(key)

    if (!entry) {
      places.set(key, { place: key || null, price, at: e.created_at, min: price, count: 1 })
      continue
    }

    entry.count += 1
    entry.min = Math.min(entry.min, price)
    if (String(e.created_at) > String(entry.at)) {
      entry.price = price
      entry.at = e.created_at
    }
  }

  return [...places.values()].sort((a, b) => a.price - b.price)
}

// Ціна за одиницю обʼєму, якщо фасування відоме. Дві пляшки різного
// розміру порівнювати за ціною упаковки нечесно: більша завжди дорожча.
export function unitPrice(price, item) {
  const size = Number(item?.pack_size)
  if (!item?.pack_unit || !Number.isFinite(size) || size <= 0) return null
  return Number(price) / size
}

// Найвигідніша відома пропозиція в межах потреби: яку марку і де брати.
// Якщо фасування відоме в усіх кандидатів — порівнюємо за обʼємом,
// інакше за ціною упаковки (і лише серед однакових одиниць).
export function bestOffer(group, events = []) {
  const byItem = new Map()
  for (const e of events) {
    if (!priced(e)) continue
    const list = byItem.get(e.item_id) ?? []
    list.push(e)
    byItem.set(e.item_id, list)
  }

  const offers = []
  for (const item of group?.items ?? []) {
    for (const offer of pricesByPlace(byItem.get(item.id))) {
      offers.push({ item, ...offer, perUnit: unitPrice(offer.price, item) })
    }
  }
  if (!offers.length) return null

  const units = new Set(offers.map(o => o.item.pack_unit ?? null))
  const comparableByVolume = offers.every(o => o.perUnit !== null) && units.size === 1

  const pool = comparableByVolume
    ? offers
    : offers.filter(o => o.item.unit === group.unit)
  if (!pool.length) return null

  const key = o => (comparableByVolume ? o.perUnit : o.price)
  const best = pool.reduce((a, b) => (key(b) < key(a) ? b : a))

  return {
    ...best,
    byVolume: comparableByVolume,
    // Порада має сенс лише тоді, коли було з чим порівнювати.
    alternatives: pool.length - 1,
  }
}
