// Резервна копія — єдиний захист обліку: безкоштовний Supabase не дає
// відновлення на момент часу. Файл має бути самодостатнім: з нього
// облік відновлюється вручну, навіть якщо застосунку вже не існує.
export const BACKUP_FORMAT = 'zapasy-backup'
export const BACKUP_VERSION = 1

// Службові поля прибрані: user_id однаковий у всіх рядках і при
// відновленні в інший акаунт лише заважав би.
const strip = ({ user_id: _userId, ...rest }) => rest

export function buildBackup({ items = [], categories = [], events = [], exportedAt = new Date() }) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exported_at: exportedAt.toISOString(),
    // Кількість рядків дублює довжину масивів навмисно: відкривши файл
    // очима, одразу видно, чи він повний, не рахуючи записи.
    counts: {
      categories: categories.length,
      items: items.length,
      events: events.length,
    },
    note: 'Фото не входять у копію: вони лежать у сховищі окремо.',
    categories: categories.map(strip),
    items: items.map(strip),
    events: events.map(strip),
  }
}

export function backupFilename(date = new Date()) {
  const pad = n => String(n).padStart(2, '0')
  return `zapasy-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}

// Скільки днів минуло від останньої копії. Потрібно, щоб нагадати:
// копія, зроблена пів року тому, захищає лише від половини втрат.
export function daysSince(iso, now = new Date()) {
  if (!iso) return null
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  return Math.floor((now - then) / 86_400_000)
}
