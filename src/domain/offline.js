import { applyDelta } from './optimistic.js'

// Офлайн тут дешевший, ніж здавалось на етапі проєктування, бо журнал
// зберігає ЗМІНИ, а не підсумки. Операції «+1» і «−1» комутативні:
// байдуже, в якому порядку вони дійдуть до бази і що встигло статись
// на іншому пристрої, — результат однаковий. Тому правило вирішення
// конфліктів не потрібне: відкладені операції просто досилаються.

// Помилка мережі відрізняється від відмови сервера: першу має сенс
// відкласти, другу — ні, бо повтор дасть ту саму відмову.
export function isNetworkError(error, online = true) {
  if (!online) return true
  const text = String(error?.message ?? error ?? '')
  return /failed to fetch|load failed|networkerror|network request failed|fetch failed/i.test(text)
}

// Відкладені операції накладаються на збережений знімок так само, як
// оптимістичне оновлення: інакше після перезапуску без мережі екран
// показував би числа до дотиків, які вже зроблені.
export function applyQueue(items = [], queue = []) {
  return queue.reduce((current, op) => {
    if ((op.extra?.bucket ?? 'stock') !== 'stock') return current
    return applyDelta(current, op.itemId, op.delta).items
  }, items)
}
