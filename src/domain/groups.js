import { expiryState, localDate } from './expiry.js'

// Запас вимірюється потребою, а не маркою: чотири різні зубні щітки —
// це один запас із чотирьох одиниць. Тому кількості складаються в межах
// категорії, а поріг береться з неї ж.
export function groupItems(items = [], categories = [], today = localDate()) {
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
    // Ціль задається лише на підкатегорії, як і поріг.
    const target = category?.parent_id ? category.target : null

    const group = groups.get(key) ?? {
      key, name, threshold, target,
      categoryId: category?.id ?? null,
      unit: item.unit,
      total: 0,
      inStock: 0,
      inUse: 0,
      expired: 0,
      expiringSoon: 0,
      items: [],
    }

    // Поріг порівнюється з СУМОЮ: те, що вже у ванній, так само закриває
    // потребу, як і те, що стоїть у шафі. Інакше застосунок вимагав би
    // купувати запас до вже відкритої пляшки.
    group.inStock += Number(item.qty)
    group.inUse += Number(item.in_use ?? 0)
    group.total += Number(item.qty) + Number(item.in_use ?? 0)

    // Прострочене не закриває потребу: три упаковки прострочених ліків —
    // це нуль упаковок. Воно лишається в підсумку (річ фізично є), але
    // не рахується як запас, тож сигнал «закінчується» не мовчить.
    const expiry = expiryState(item, today)
    if (expiry?.state === 'expired') group.expired += Number(item.qty) + Number(item.in_use ?? 0)
    if (expiry?.state === 'soon') group.expiringSoon += 1
    group.items.push(item)
    groups.set(key, group)
  }

  return [...groups.values()]
    .map(group => ({
      ...group,
      usable: group.total - group.expired,
      // Складати кілограми зі штуками безглуздо, але заборонити це на
      // рівні даних не можна — позначаємо, щоб інтерфейс попередив,
      // і даємо чесну розбивку замість хибної суми.
      mixedUnits: new Set(group.items.map(i => i.unit)).size > 1,
      byUnit: byUnit(group.items),
      // Всередині групи попереду те, чого лишилось найменше.
      items: [...group.items].sort(
        (a, b) => Number(a.qty) - Number(b.qty) || a.name.localeCompare(b.name, 'uk')
      ),
      low: group.total - group.expired <= group.threshold,
      urgency: (group.total - group.expired) / (group.threshold > 0 ? group.threshold : 1),
    }))
    // Спершу те, що потребує уваги, далі стало за абеткою. Сортування
    // суто за терміновістю перемішувало список після кожної витрати,
    // і речі щодня опинялись на новому місці.
    .sort((a, b) =>
      (a.low === b.low ? 0 : a.low ? -1 : 1) || a.name.localeCompare(b.name, 'uk'))
}

function byUnit(items) {
  const totals = new Map()
  for (const item of items) {
    const sum = Number(item.qty) + Number(item.in_use ?? 0)
    totals.set(item.unit, (totals.get(item.unit) ?? 0) + sum)
  }
  return [...totals.entries()].map(([unit, total]) => ({ unit, total }))
}
