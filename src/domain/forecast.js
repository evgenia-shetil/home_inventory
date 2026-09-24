import { plural } from '../lib/plural.js'

// Прогноз будується з темпу витрачання за журналом. Поріг спрацьовує,
// коли запас уже на межі, — для доставки це пізно. Прогноз попереджає
// заздалегідь, не вимагаючи жодного нового введення.
//
// Він навмисно мовчить, доки історії мало: темп, порахований за два дні
// або з двох витрат, — шум, і хибне «закінчиться завтра» шкодить довірі
// більше, ніж відсутність прогнозу.
export const MIN_DAYS = 21
export const MIN_EVENTS = 3
export const HORIZON_DAYS = 14

const DAY = 86_400_000

// Події, записані до зміни одиниці виміру, рахувались в інших одиницях
// (мл замість упаковок) і змішали б темп.
function comparableEvents(events, itemIds) {
  const lastUnitChange = new Map()
  for (const e of events) {
    if (e.kind !== 'unit' || !itemIds.has(e.item_id)) continue
    const prev = lastUnitChange.get(e.item_id)
    if (!prev || String(e.created_at) > prev) lastUnitChange.set(e.item_id, String(e.created_at))
  }

  return events.filter(e => {
    if (!itemIds.has(e.item_id)) return false
    const cut = lastUnitChange.get(e.item_id)
    return !cut || String(e.created_at) > cut
  })
}

export function consumptionRate(group, events = [], now = new Date()) {
  const itemIds = new Set((group?.items ?? []).map(i => i.id))
  const relevant = comparableEvents(events, itemIds)
  if (!relevant.length) return null

  // Відлік від першої події будь-якого виду: поповнення, після якого
  // нічого не витрачали, — теж інформація про темп (він низький).
  const start = Math.min(...relevant.map(e => new Date(e.created_at).getTime()))
  const days = (now.getTime() - start) / DAY

  // Перенесення в користування — не витрата, сума від нього не міняється.
  const consumed = relevant.filter(e => e.kind === 'consume')
  const used = consumed.reduce((sum, e) => sum + Math.abs(Number(e.delta)), 0)

  if (days < MIN_DAYS || consumed.length < MIN_EVENTS || used <= 0) return null
  return { perDay: used / days, days, events: consumed.length }
}

export function forecast(group, events = [], now = new Date()) {
  const rate = consumptionRate(group, events, now)
  if (!rate) return null

  // Прострочене вже не запас — рахуємо лише придатне.
  const total = Number(group.usable ?? group.total)
  const threshold = Number(group.threshold ?? 0)

  return {
    perDay: rate.perDay,
    daysLeft: total / rate.perDay,
    // Скільки лишилось до сигналу «закінчується». Нуль — уже на межі.
    daysToSignal: Math.max(0, (total - threshold) / rate.perDay),
  }
}

// Те, що ще не нижче порога, але дійде до нього найближчим часом.
// Разові речі не прогнозуються: їх не поповнюють.
export function upcoming(groups = [], events = [], now = new Date(), horizon = HORIZON_DAYS) {
  return groups
    .filter(g => !g.low)
    .filter(g => g.items.some(i => i.recurring !== false))
    .map(g => ({ group: g, forecast: forecast(g, events, now) }))
    .filter(x => x.forecast && x.forecast.daysToSignal <= horizon)
    .sort((a, b) => a.forecast.daysToSignal - b.forecast.daysToSignal)
}

// Прогноз — оцінка, тож і мова округла: «близько 2 тижнів», а не «13,4 дня».
export function formatDuration(days) {
  if (days < 1) return 'менше доби'
  if (days < 14) {
    const n = Math.round(days)
    return `${n} ${plural(n, 'день', 'дні', 'днів')}`
  }
  if (days < 60) {
    const n = Math.round(days / 7)
    return `${n} ${plural(n, 'тиждень', 'тижні', 'тижнів')}`
  }
  const n = Math.round(days / 30)
  return `${n} ${plural(n, 'місяць', 'місяці', 'місяців')}`
}
