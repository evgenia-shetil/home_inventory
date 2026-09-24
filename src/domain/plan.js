import { consumptionRate, normPerDay, MONTH_DAYS } from './forecast.js'
import { expiryState, localDate } from './expiry.js'
import { bestOffer } from './prices.js'

// План закупівлі: скільки купити одразу, щоб вистачило на період.
// Мета — рідкісні великі закупівлі замість постійних дрібних.
//
// Запас на кінець періоду доходить до нуля: так вирішила користувачка,
// бо закупівля планова, і буфер лише збільшував би корзину.
export { normPerDay, MONTH_DAYS }
export const HORIZONS = [3, 6, 12]

const EPS = 1e-9

// Звідки темп: норма, якщо задана, — вона відображає звичку, яку людина
// знає краще за короткий журнал. Інакше журнал, якщо історії досить.
export function groupRate(group, category, events = [], now = new Date()) {
  const norm = normPerDay(category)
  if (norm !== null) return { perDay: norm, source: 'norm' }
  const journal = consumptionRate(group, events, now)
  if (journal) return { perDay: journal.perDay, source: 'journal' }
  return null
}

// Календарні місяці для дат заміни: «кожні 3 місяці від 15 вересня» —
// це 15 грудня, а не через 91,3 дня. Дробові місяці рахуються днями.
export function addMonths(iso, months) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (Number.isInteger(months)) {
    const target = new Date(Date.UTC(y, m - 1 + months, 1))
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
    target.setUTCDate(Math.min(d, lastDay))
    return target.toISOString().slice(0, 10)
  }
  const date = new Date(Date.UTC(y, m - 1, d) + Math.round(months * MONTH_DAYS) * 86_400_000)
  return date.toISOString().slice(0, 10)
}

// Наступна заміна. Без дати останньої заміни вважаємо, що час уже настав:
// краще зайве нагадування, ніж щітка, яку ніхто не міняв пів року.
export function nextReplacement(category, today = localDate()) {
  const months = Number(category?.usage_months)
  if (!category?.scheduled || !(months > 0)) return null
  if (!category.replaced_on) return today
  return addMonths(category.replaced_on, months)
}

// Скільки замін припаде на період. Прострочена заміна відбудеться
// сьогодні, і наступні рахуються вже від неї.
export function replacementsWithin(category, horizonMonths, today = localDate()) {
  const next = nextReplacement(category, today)
  if (!next) return 0
  const months = Number(category.usage_months)
  const end = addMonths(today, horizonMonths)
  let date = next < today ? today : next
  let count = 0
  // Обмеження ітерацій — захист від норми на кшталт «кожні 0,001 місяця».
  while (date < end && count < 1000) {
    count += 1
    date = addMonths(date, months)
  }
  return count
}

// Придатний запас. Прострочене не рахується ніде (інваріант 10).
// Для речей за графіком — лише шафа: та, що в користуванні, однаково
// піде на заміну і майбутньої заміни не покриває.
// Норма задана в одиницях групи. Марки в інших одиницях (150 мл поруч
// зі штуками) не складаються з нею: інакше 150 мл «покривали» б рік
// шампуню, і потреба мовчки зникала б із плану.
function usableStock(group, today, stockOnly) {
  return group.items.reduce((sum, item) => {
    if (item.unit !== group.unit) return sum
    if (expiryState(item, today)?.state === 'expired') return sum
    return sum + Number(item.qty) + (stockOnly ? 0 : Number(item.in_use ?? 0))
  }, 0)
}

function unitPrice(group, events) {
  const offer = events ? bestOffer(group, events) : null
  if (offer) return { price: offer.price, item: offer.item, place: offer.place }
  const priced = group.items.filter(i => i.last_price !== null && i.last_price !== undefined)
  if (!priced.length) return null
  const item = priced.reduce((a, b) => (Number(b.last_price) < Number(a.last_price) ? b : a))
  return { price: Number(item.last_price), item, place: item.last_place ?? null }
}

export function planGroup(group, category, { events = [], horizon, today = localDate(), now = new Date() } = {}) {
  if (!group.items.some(i => i.recurring !== false)) return null

  const scheduled = Boolean(category?.scheduled) && Number(category?.usage_months) > 0
  const base = { group, category, scheduled, warning: group.mixedUnits ? 'mixed' : null }

  if (scheduled) {
    const replacements = replacementsWithin(category, horizon, today)
    const perReplacement = Number(category.usage_qty) > 0 ? Number(category.usage_qty) : 1
    const need = replacements * perReplacement
    const have = usableStock(group, today, true)
    return { ...base, source: 'schedule', replacements, need, have, buy: Math.max(0, Math.ceil(need - have - EPS)) }
  }

  const rate = groupRate(group, category, events, now)
  if (!rate) return { ...base, source: null, need: null, have: usableStock(group, today, false), buy: null }

  const need = rate.perDay * horizon * MONTH_DAYS
  const have = usableStock(group, today, false)
  return { ...base, source: rate.source, need, have, buy: Math.max(0, Math.ceil(need - have - EPS)) }
}

export function buildPlan(groups, categories, { events = [], horizon, today = localDate(), now = new Date() } = {}) {
  const byId = new Map(categories.map(c => [c.id, c]))
  const rows = []
  const unknown = []
  let covered = 0
  let total = 0
  let priced = 0

  for (const group of groups) {
    const row = planGroup(group, byId.get(group.categoryId), { events, horizon, today, now })
    if (!row) continue
    if (row.buy === null) { unknown.push(row); continue }
    if (row.buy === 0) { covered += 1; continue }

    const offer = unitPrice(group, events)
    const cost = offer ? offer.price * row.buy : null
    if (cost !== null) { total += cost; priced += 1 }
    rows.push({ ...row, offer, cost })
  }

  rows.sort((a, b) => a.group.name.localeCompare(b.group.name, 'uk'))
  unknown.sort((a, b) => a.group.name.localeCompare(b.group.name, 'uk'))
  return { rows, unknown, covered, total, priced }
}

// Заміни, до яких лишилось не більше `days` днів (і прострочені).
export function dueReplacements(categories = [], today = localDate(), days = 3) {
  const limit = addMonths(today, days / MONTH_DAYS)
  return categories
    .map(category => ({ category, due: nextReplacement(category, today) }))
    .filter(x => x.due && x.due <= limit)
    .sort((a, b) => a.due.localeCompare(b.due))
}
