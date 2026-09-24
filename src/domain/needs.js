// Скільки докупити, щоб вийшла ціль. Поріг відповідає лише на питання
// «коли сигналити», тож без цілі список покупок не може сказати кількість.
export function toBuy(group) {
  const target = group?.target
  if (target === null || target === undefined || target === '') return null
  // Прострочене в запас не входить: його доведеться замінити.
  return Math.max(0, Number(target) - Number(group.usable ?? group.total))
}

// Разова річ, скінчившись, не має оселятись у списку покупок назавжди.
export function shoppingGroups(groups = []) {
  return groups
    .filter(group => group.low)
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.recurring !== false),
    }))
    .filter(group => group.items.length > 0)
}
