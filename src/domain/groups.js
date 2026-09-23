// Запас вимірюється потребою, а не маркою: чотири різні зубні щітки —
// це один запас із чотирьох одиниць. Тому кількості складаються в межах
// категорії, а поріг береться з неї ж.
export function groupItems(items = [], categories = []) {
  const byId = new Map(categories.map(c => [c.id, c]))
  const groups = new Map()

  for (const item of items) {
    const category = item.category_id ? byId.get(item.category_id) : null

    // Товар поза категоріями лишається групою сам по собі — тоді працює
    // його власний поріг, як і раніше.
    const key = category ? `c:${category.id}` : `i:${item.id}`
    const name = category ? category.name : item.name
    const threshold = Number(category ? category.threshold : item.threshold)

    const group = groups.get(key) ?? {
      key, name, threshold,
      categoryId: category?.id ?? null,
      unit: item.unit,
      total: 0,
      items: [],
    }

    group.total += Number(item.qty)
    group.items.push(item)
    groups.set(key, group)
  }

  return [...groups.values()]
    .map(group => ({
      ...group,
      // Всередині групи попереду те, чого лишилось найменше.
      items: [...group.items].sort(
        (a, b) => Number(a.qty) - Number(b.qty) || a.name.localeCompare(b.name, 'uk')
      ),
      low: group.total <= group.threshold,
      urgency: group.total / (group.threshold > 0 ? group.threshold : 1),
    }))
    .sort((a, b) => a.urgency - b.urgency || a.name.localeCompare(b.name, 'uk'))
}
