// Ціна й місце вже зберігаються в кожному поповненні — з цього виходить
// відповідь «скільки витрачено», не збираючи нічого додатково.
export function summariseSpending(events = [], items = [], categories = []) {
  const itemById = new Map(items.map(i => [i.id, i]))
  const catById = new Map(categories.map(c => [c.id, c]))

  const rootName = categoryId => {
    const c = catById.get(categoryId)
    if (!c) return 'без категорії'
    return c.parent_id ? (catById.get(c.parent_id)?.name ?? c.name) : c.name
  }

  const months = new Map()
  const byCategory = new Map()
  let total = 0

  for (const e of events) {
    if (e.kind !== 'restock') continue
    if (e.price === null || e.price === undefined) continue

    const sum = Number(e.price) * Math.abs(Number(e.delta))
    if (!Number.isFinite(sum) || sum === 0) continue

    total += sum

    const key = String(e.created_at).slice(0, 7)
    months.set(key, (months.get(key) ?? 0) + sum)

    const name = rootName(itemById.get(e.item_id)?.category_id)
    byCategory.set(name, (byCategory.get(name) ?? 0) + sum)
  }

  return {
    total,
    months: [...months.entries()]
      .map(([key, value]) => ({ key, total: value }))
      .sort((a, b) => b.key.localeCompare(a.key)),
    byCategory: [...byCategory.entries()]
      .map(([name, value]) => ({ name, total: value }))
      .sort((a, b) => b.total - a.total),
  }
}
