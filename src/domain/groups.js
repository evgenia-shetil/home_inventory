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

    // Товар, причеплений просто до головної категорії, утворює групу з тим
    // самим іменем — і в переліку це виглядає як підкатегорія, названа так
    // само, як категорія. Позначаємо явно, що це нерозкладений залишок.
    const isUnsortedRoot =
      category && !category.parent_id &&
      categories.some(c => c.parent_id === category.id)

    const name = category
      ? (isUnsortedRoot ? `${category.name} · без підкатегорії` : category.name)
      : item.name
    // Поріг — властивість ПІДКАТЕГОРІЇ: саме вона описує потребу.
    // Головна категорія лише папка, а нерозкладені товари й ті, що поза
    // категоріями, працюють на власному запасному порозі.
    const threshold = Number(
      category?.parent_id ? category.threshold : item.threshold
    )

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
