import { groupItems } from './groups.js'
import { isNeed } from './needs.js'

// Нерозкладене: товар або взагалі без категорії, або причеплений до
// головної, у якої є підкатегорії, — тоді він висить поза потребами.
export function unsortedItems(items = [], categories = []) {
  const byId = new Map(categories.map(c => [c.id, c]))
  return items.filter(item => {
    if (!item.category_id) return true
    const c = byId.get(item.category_id)
    return Boolean(c) && !c.parent_id && categories.some(x => x.parent_id === c.id)
  })
}

export function branchItems(rootId, items = [], categories = []) {
  const ids = new Set([rootId, ...categories.filter(c => c.parent_id === rootId).map(c => c.id)])
  return items.filter(item => ids.has(item.category_id))
}

// Плитка головної категорії відповідає на одне питання: чи треба туди
// зазирнути. Тому рахуються потреби й прострочене, а не марки.
export function rootSummaries(items = [], categories = [], today) {
  return categories
    .filter(c => !c.parent_id)
    .map(category => {
      const groups = groupItems(branchItems(category.id, items, categories), categories, today)
      return {
        category,
        groups: groups.length,
        needs: groups.filter(isNeed).length,
        expired: groups.filter(g => g.expired > 0).length,
      }
    })
}
