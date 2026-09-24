import { describe, it, expect } from 'vitest'
import {
  normPerDay, groupRate, addMonths, nextReplacement, replacementsWithin,
  planGroup, buildPlan, dueReplacements, MONTH_DAYS,
} from './plan.js'

const today = '2026-09-24'
const now = new Date('2026-09-24T12:00:00Z')

const item = (id, qty, extra = {}) =>
  ({ id, name: id, qty, in_use: 0, unit: 'шт', recurring: true, last_price: null, ...extra })
const group = (items, extra = {}) => ({
  key: 'g', name: 'потреба', categoryId: 'c', unit: 'шт', mixedUnits: false,
  items, total: items.reduce((s, i) => s + i.qty + (i.in_use ?? 0), 0), ...extra,
})

describe('normPerDay', () => {
  it('«1 кожні 3 місяці» у перерахунку на день', () => {
    expect(normPerDay({ usage_qty: 1, usage_months: 3 })).toBeCloseTo(1 / (3 * MONTH_DAYS))
  })

  it('без норми — null', () => {
    expect(normPerDay({ usage_qty: null, usage_months: 3 })).toBeNull()
    expect(normPerDay({ usage_qty: 1, usage_months: 0 })).toBeNull()
  })
})

describe('groupRate', () => {
  it('норма має пріоритет над журналом', () => {
    expect(groupRate(group([item('a', 1)]), { usage_qty: 1, usage_months: 1 }, [], now).source).toBe('norm')
  })

  it('без норми й журналу темп невідомий', () => {
    expect(groupRate(group([item('a', 1)]), {}, [], now)).toBeNull()
  })
})

describe('addMonths', () => {
  it('календарні місяці, а не 30 днів', () => {
    expect(addMonths('2026-09-15', 3)).toBe('2026-12-15')
  })

  it('кінець місяця не перескакує в наступний', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
  })

  it('перехід через рік', () => {
    expect(addMonths('2026-11-10', 3)).toBe('2027-02-10')
  })
})

describe('заміна за графіком', () => {
  const brush = { scheduled: true, usage_qty: 1, usage_months: 3, replaced_on: '2026-09-01' }

  it('наступна заміна — від останньої', () => {
    expect(nextReplacement(brush, today)).toBe('2026-12-01')
  })

  it('без дати заміна потрібна вже', () => {
    expect(nextReplacement({ ...brush, replaced_on: null }, today)).toBe(today)
  })

  it('не за графіком — дат немає', () => {
    expect(nextReplacement({ ...brush, scheduled: false }, today)).toBeNull()
  })

  it('рахує заміни в межах року', () => {
    // 1 груд, 1 бер, 1 черв, 1 вер — чотири до 24 вересня наступного року.
    expect(replacementsWithin(brush, 12, today)).toBe(4)
  })

  it('прострочена заміна рахується як сьогоднішня', () => {
    const late = { ...brush, replaced_on: '2026-05-01' } // мала бути 1 серпня
    // Сьогодні й 24 грудня; 24 березня — вже межа періоду, туди не входить.
    expect(replacementsWithin(late, 6, today)).toBe(2)
  })
})

describe('planGroup — витрачається', () => {
  const norm = { usage_qty: 2, usage_months: 1 } // 2 на місяць

  it('купити = норма × період − запас, до нуля', () => {
    const row = planGroup(group([item('a', 3, { in_use: 1 })]), norm, { horizon: 6, today, now })
    expect(row.need).toBeCloseTo(12)
    expect(row.have).toBe(4)
    expect(row.buy).toBe(8)
    expect(row.source).toBe('norm')
  })

  it('округлює вгору до цілих', () => {
    const row = planGroup(group([item('a', 0)]), { usage_qty: 1, usage_months: 4 }, { horizon: 6, today, now })
    expect(row.buy).toBe(2)
  })

  it('достатньо запасу — купувати нічого', () => {
    // 2 на місяць: рік — 24, пів року — 12; у запасі 15.
    expect(planGroup(group([item('a', 15)]), norm, { horizon: 12, today, now }).buy).toBe(9)
    expect(planGroup(group([item('a', 15)]), norm, { horizon: 6, today, now }).buy).toBe(0)
  })

  it('прострочене в запас не входить', () => {
    const row = planGroup(group([item('a', 5, { expires_on: '2026-01-01' })]), norm, { horizon: 3, today, now })
    expect(row.have).toBe(0)
    expect(row.buy).toBe(6)
  })

  it('разові речі не плануються', () => {
    expect(planGroup(group([item('a', 0, { recurring: false })]), norm, { horizon: 6, today, now })).toBeNull()
  })

  it('без темпу — купити невідомо', () => {
    expect(planGroup(group([item('a', 1)]), {}, { horizon: 6, today, now }).buy).toBeNull()
  })

  it('марки в інших одиницях у запас не складаються', () => {
    const row = planGroup(
      group([item('флакон', 2), item('дорожній', 150, { unit: 'мл' })], { mixedUnits: true }),
      norm, { horizon: 6, today, now })
    expect(row.have).toBe(2)
    expect(row.buy).toBe(10)
    expect(row.warning).toBe('mixed')
  })

  it('змішані одиниці позначаються', () => {
    expect(planGroup(group([item('a', 1)], { mixedUnits: true }), norm, { horizon: 6, today, now }).warning).toBe('mixed')
  })
})

describe('planGroup — за графіком', () => {
  const brush = { scheduled: true, usage_qty: 1, usage_months: 3, replaced_on: '2026-09-01' }

  it('те, що в користуванні, заміну не покриває', () => {
    const row = planGroup(group([item('a', 1, { in_use: 1 })]), brush, { horizon: 12, today, now })
    expect(row.replacements).toBe(4)
    expect(row.have).toBe(1)
    expect(row.buy).toBe(3)
  })
})

describe('buildPlan', () => {
  const cats = [
    { id: 'c', usage_qty: 1, usage_months: 1 },
    { id: 'full', usage_qty: 1, usage_months: 12 },
  ]
  const groups = [
    group([item('паста', 0, { last_price: 80 })], { key: 'a', name: 'паста', categoryId: 'c' }),
    group([item('лак', 5)], { key: 'b', name: 'лак', categoryId: 'full' }),
    group([item('невідоме', 1)], { key: 'c', name: 'невідоме', categoryId: null }),
  ]

  it('ділить на покупки, покрите й невідомий темп', () => {
    const plan = buildPlan(groups, cats, { horizon: 6, today, now })
    expect(plan.rows.map(r => r.group.name)).toEqual(['паста'])
    expect(plan.rows[0].buy).toBe(6)
    expect(plan.covered).toBe(1)
    expect(plan.unknown.map(r => r.group.name)).toEqual(['невідоме'])
  })

  it('рахує вартість за найнижчою відомою ціною', () => {
    const plan = buildPlan(groups, cats, { horizon: 6, today, now })
    expect(plan.rows[0].cost).toBe(480)
    expect(plan.total).toBe(480)
    expect(plan.priced).toBe(1)
  })
})

describe('dueReplacements', () => {
  it('за три дні до дати й прострочені', () => {
    const cats = [
      { id: 'soon', scheduled: true, usage_months: 1, replaced_on: '2026-08-26' },  // 26 вер
      { id: 'late', scheduled: true, usage_months: 1, replaced_on: '2026-07-01' },  // 1 серп
      { id: 'later', scheduled: true, usage_months: 1, replaced_on: '2026-09-10' }, // 10 жовт
      { id: 'plain', scheduled: false, usage_months: 1 },
    ]
    expect(dueReplacements(cats, today).map(x => x.category.id)).toEqual(['late', 'soon'])
  })
})
