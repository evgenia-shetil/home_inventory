// Орієнтовна вартість списку покупок: по одній одиниці з кожної потреби,
// за найдешевшою з відомих цін. Це оцінка, а не рахунок — ціни зберігаються
// з останньої покупки і могли змінитись.
export function estimateCost(groups = []) {
  let total = 0
  let known = 0
  let unknown = 0

  for (const group of groups) {
    const prices = group.items
      .map(item => item.last_price)
      .filter(price => price !== null && price !== undefined && price !== '')
      .map(Number)

    if (!prices.length) {
      unknown += 1
      continue
    }

    total += Math.min(...prices)
    known += 1
  }

  return { total, known, unknown }
}
