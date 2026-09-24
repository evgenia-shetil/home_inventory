import { plural } from '../lib/plural.js'

// Для ліків і косметики дата важливіша за кількість: три упаковки
// прострочених ліків — це нуль упаковок. Тому термін — окремий сигнал
// поруч із «закінчується», і одне не маскує інше.
export const SOON_DAYS = 30

const DAY = 86_400_000

// Дата без часу в місцевому поясі. toISOString() дав би UTC, і після
// півночі за Києвом «сьогодні» ще кілька годин було б учора.
export function localDate(now = new Date()) {
  const pad = n => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / DAY)
}

// Річ, якої вже немає, не може зіпсуватись: дата лишається в картці,
// але сигналу не дає.
export function expiryState(item, today = localDate()) {
  if (!item?.expires_on) return null
  const total = Number(item.qty ?? 0) + Number(item.in_use ?? 0)
  if (total <= 0) return null

  const days = daysBetween(today, String(item.expires_on).slice(0, 10))
  if (days < 0) return { state: 'expired', days }
  if (days <= SOON_DAYS) return { state: 'soon', days }
  return { state: 'ok', days }
}

export const isExpired = (item, today) => expiryState(item, today)?.state === 'expired'

// Перелік для окремого погляду: спершу прострочене, далі за датою.
export function expiringItems(items = [], today = localDate()) {
  return items
    .map(item => ({ item, expiry: expiryState(item, today) }))
    .filter(x => x.expiry && x.expiry.state !== 'ok')
    .sort((a, b) => a.expiry.days - b.expiry.days)
}

export function describeExpiry(expiry) {
  if (!expiry) return null
  const { state, days } = expiry
  if (state === 'expired') {
    const ago = -days
    return ago === 0 ? 'прострочено' : `прострочено ${ago} ${plural(ago, 'день', 'дні', 'днів')} тому`
  }
  if (days === 0) return 'останній день'
  if (days === 1) return 'до завтра'
  return `ще ${days} ${plural(days, 'день', 'дні', 'днів')}`
}

// Поповнення приносить нову упаковку зі своєю датою, а старі лишаються.
// Рядок тримає НАЙБЛИЖЧУ дату: саме вона важлива, щоб нічого не зіпсувалось.
// Якщо старого запасу вже немає, його дата нічого не означає.
export function mergeExpiry(current, incoming, stockBefore) {
  if (!incoming) return current ?? null
  if (!current || Number(stockBefore) <= 0) return incoming
  return current < incoming ? current : incoming
}
