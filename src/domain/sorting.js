// Терміновість — відносна, а не абсолютна: товар з порогом 10 і залишком 4
// потребує уваги більше, ніж той, де лишилась одна одиниця з однієї.
function urgency(item) {
  const threshold = Number(item.threshold) > 0 ? Number(item.threshold) : 1
  return Number(item.qty) / threshold
}

export function isLow(item) {
  return Number(item.qty) <= Number(item.threshold)
}

export function sortByUrgency(items) {
  return [...items].sort(
    (a, b) => urgency(a) - urgency(b) || a.name.localeCompare(b.name, 'uk')
  )
}
