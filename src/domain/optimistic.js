// Повертає новий список і фактично застосовану зміну.
// Фактична зміна потрібна для відкату: відкочувати треба саме її
// (зворотною операцією), а не повертати запам'ятоване значення.
export function applyDelta(items, itemId, delta) {
  let applied = 0

  const next = items.map(item => {
    if (item.id !== itemId) return item
    const newQty = Math.max(0, Number(item.qty) + Number(delta))
    applied = newQty - Number(item.qty)
    return { ...item, qty: newQty }
  })

  return { items: next, applied }
}
