// Магазини не зберігаються окремо: список збирається з того, що вже
// введено в товарах, плюс кілька стартових назв. Додала магазин одному
// товару — він сам з'явиться у списку для наступних.
const SEED = ['Нотіно', 'EVA', 'MAKEUP', 'Аптека', 'Сільпо', 'АТБ']

export function collectPlaces(items = []) {
  const byKey = new Map()

  const add = value => {
    const name = (value ?? '').trim()
    if (!name) return
    const key = name.toLowerCase()
    if (!byKey.has(key)) byKey.set(key, name)
  }

  SEED.forEach(add)
  items.forEach(item => add(item.last_place))

  return [...byKey.values()].sort((a, b) => a.localeCompare(b, 'uk'))
}
