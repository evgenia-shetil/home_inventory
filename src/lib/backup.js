import { supabase } from './supabase.js'
import { buildBackup, backupFilename } from '../domain/backup.js'

const PAGE = 1000
const LAST_KEY = 'zapasy:last-backup'

// Supabase віддає не більше тисячі рядків за запит, а журнал росте
// щодня. Без посторінкового читання копія мовчки обрізалась би.
async function readAll(table, order) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table).select('*')
      .order(order, { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}

// Дані читаються з бази, а не зі стану застосунку: копія має
// відображати те, що справді збережено, а не оптимістичний стан екрана.
export async function exportBackup() {
  const [categories, items, events] = await Promise.all([
    readAll('categories', 'created_at'),
    readAll('items', 'created_at'),
    readAll('events', 'created_at'),
  ])

  const now = new Date()
  const backup = buildBackup({ categories, items, events, exportedAt: now })
  const file = new File(
    [JSON.stringify(backup, null, 2)],
    backupFilename(now),
    { type: 'application/json' },
  )

  const how = await saveFile(file)
  if (how !== 'cancelled') rememberBackup(now)
  return { how, counts: backup.counts }
}

// На телефоні завантаження з PWA на головному екрані губиться або
// відкривається переглядом без кнопки збереження. Системне меню
// «Поділитись» дає «Зберегти у Файли» — туди копія й має потрапити.
async function saveFile(file) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name })
      return 'shared'
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled'
      // Інші відмови (наприклад, заборона без жесту) — падаємо на завантаження.
    }
  }

  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

// Дата останньої копії — зручність одного пристрою, а не факт про дані,
// тож лежить у браузері. Недоступне сховище не має ламати експорт.
export function lastBackupAt() {
  try {
    return localStorage.getItem(LAST_KEY)
  } catch {
    return null
  }
}

function rememberBackup(date) {
  try {
    localStorage.setItem(LAST_KEY, date.toISOString())
  } catch {
    // Приватний режим — нагадування просто не працюватиме.
  }
}
