// Пошук по словах у будь-якому порядку: у назвах з каталогів бренд може
// стояти і спереду, і в кінці, тож підрядок цілком тут не працює.
const wordsOf = query => String(query).toLowerCase().split(/\s+/).filter(Boolean)
const matches = (text, words) => {
  const name = (text ?? '').toLowerCase()
  return words.every(word => name.includes(word))
}

export function searchItems(items = [], query = '') {
  const words = wordsOf(query)
  if (!words.length) return items
  return items.filter(item => matches(item.name, words))
}

// Шукають не лише марку («Colgate»), а й потребу («паста»): марка часто
// названа так, що слова «паста» в ній немає. Тоді збігом є підкатегорія,
// а через неї видно всі її марки. Головні категорії теж шукаються, але
// йдуть після підкатегорій — конкретніше попереду.
export function searchCategories(categories = [], query = '') {
  const words = wordsOf(query)
  if (!words.length) return []
  return categories
    .filter(c => matches(c.name, words))
    .sort((a, b) =>
      (a.parent_id ? 0 : 1) - (b.parent_id ? 0 : 1) || a.name.localeCompare(b.name, 'uk'))
}
