import { suggestCategory } from './suggest.js'

// Словник підказок росте разом із реальним асортиментом, тож товари,
// заведені раніше, лишаються нерозкладеними. Ця функція пропонує,
// куди їх перекласти — але нічого не змінює сама.
export function planAutoSort(items = [], categories = []) {
  const byId = new Map(categories.map(c => [c.id, c]))

  return items.flatMap(item => {
    const current = item.category_id ? byId.get(item.category_id) : null
    // Те, що вже в підкатегорії, не чіпаємо: людина могла покласти свідомо.
    if (current?.parent_id) return []

    const { childId } = suggestCategory(item.name, categories)
    if (!childId || childId === item.category_id) return []

    return [{ id: item.id, name: item.name, categoryId: childId }]
  })
}
