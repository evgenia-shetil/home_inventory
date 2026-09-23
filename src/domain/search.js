// Пошук по словах у будь-якому порядку: у назвах з каталогів бренд може
// стояти і спереду, і в кінці, тож підрядок цілком тут не працює.
export function searchItems(items = [], query = '') {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return items

  return items.filter(item => {
    const name = (item.name ?? '').toLowerCase()
    return words.every(word => name.includes(word))
  })
}
