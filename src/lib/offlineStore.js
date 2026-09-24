// Знімок обліку й черга відкладених операцій живуть у браузері цього
// пристрою. Це не джерело правди, а запасний шлях на час без мережі:
// щойно звʼязок є, дані знову читаються з бази.
//
// Будь-яке звернення до сховища може впасти (приватний режим, заповнене
// місце) — тоді офлайн просто недоступний, а застосунок працює як раніше.
const snapshotKey = userId => `zapasy:snapshot:${userId}`
const queueKey = userId => `zapasy:queue:${userId}`
const LAST_USER = 'zapasy:last-user'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export const loadSnapshot = userId => read(snapshotKey(userId), null)

export function saveSnapshot(userId, items, categories) {
  write(snapshotKey(userId), { items, categories, at: new Date().toISOString() })
  write(LAST_USER, userId)
}

export const loadQueue = userId => read(queueKey(userId), [])
export const saveQueue = (userId, queue) =>
  write(queueKey(userId), queue.length ? queue : null)

// Сесія Supabase без мережі не оновлюється, і після години простою
// getSession() віддає null. Щоб без звʼязку відкрився знімок, а не
// екран входу, памʼятаємо, чий він.
export const lastUserId = () => read(LAST_USER, null)

// Вихід з акаунта прибирає все: на спільному пристрої знімок чужого
// обліку не повинен лишатись.
export function forgetUser(userId) {
  write(snapshotKey(userId), null)
  write(queueKey(userId), null)
  write(LAST_USER, null)
}
