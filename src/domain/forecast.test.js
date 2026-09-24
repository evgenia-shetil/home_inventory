import { describe, it, expect } from 'vitest'
import { consumptionRate, forecast, upcoming, formatDuration } from './forecast.js'

const now = new Date('2026-12-01T12:00:00Z')
const daysAgo = n => new Date(now.getTime() - n * 86_400_000).toISOString()
const ev = (item_id, kind, delta, ago) => ({ item_id, kind, delta, created_at: daysAgo(ago) })

const group = (over = {}) => ({
  key: 'g', total: 10, threshold: 2, low: false,
  items: [{ id: 'a', recurring: true }], ...over,
})

// 30 днів історії, 6 витрат по одній — одна одиниця на 5 днів.
const steady = [
  ev('a', 'restock', 10, 30),
  ...[25, 20, 15, 10, 5, 1].map(d => ev('a', 'consume', -1, d)),
]

describe('consumptionRate', () => {
  it('ділить витрачене на весь проміжок від першої події', () => {
    expect(consumptionRate(group(), steady, now).perDay).toBeCloseTo(6 / 30)
  })

  it('мовчить, коли історії менше трьох тижнів', () => {
    const young = [ev('a', 'restock', 5, 10), ...[8, 6, 4, 2].map(d => ev('a', 'consume', -1, d))]
    expect(consumptionRate(group(), young, now)).toBeNull()
  })

  it('мовчить, коли витрат замало', () => {
    expect(consumptionRate(group(), [ev('a', 'restock', 5, 40), ev('a', 'consume', -1, 3)], now)).toBeNull()
  })

  it('перенесення в користування не є витратою', () => {
    const moves = [ev('a', 'restock', 5, 40), ...[30, 20, 10].map(d => ev('a', 'open', 1, d))]
    expect(consumptionRate(group(), moves, now)).toBeNull()
  })

  it('чужі товари не враховуються', () => {
    expect(consumptionRate(group(), steady.map(e => ({ ...e, item_id: 'x' })), now)).toBeNull()
  })

  it('ігнорує події до зміни одиниці виміру', () => {
    const converted = [
      ...[60, 55, 50, 45].map(d => ev('a', 'consume', -100, d)),
      ev('a', 'unit', 0, 40),
      ...steady,
    ]
    expect(consumptionRate(group(), converted, now).perDay).toBeCloseTo(6 / 30)
  })
})

describe('forecast', () => {
  it('рахує дні до сигналу й до нуля', () => {
    const f = forecast(group(), steady, now)
    expect(f.daysLeft).toBeCloseTo(50)
    expect(f.daysToSignal).toBeCloseTo(40)
  })

  it('до сигналу не буває відʼємного', () => {
    expect(forecast(group({ total: 1 }), steady, now).daysToSignal).toBe(0)
  })
})

describe('upcoming', () => {
  it('бере те, що дійде до порога в межах горизонту', () => {
    const soon = group({ key: 'soon', total: 4 })   // (4-2)/0.2 = 10 днів
    const later = group({ key: 'later', total: 10 }) // 40 днів
    expect(upcoming([later, soon], steady, now).map(x => x.group.key)).toEqual(['soon'])
  })

  it('не дублює те, що вже в списку покупок', () => {
    expect(upcoming([group({ total: 1, low: true })], steady, now)).toEqual([])
  })

  it('разові речі не прогнозує', () => {
    const once = group({ total: 3, items: [{ id: 'a', recurring: false }] })
    expect(upcoming([once], steady, now)).toEqual([])
  })
})

describe('formatDuration', () => {
  it('округлює до зрозумілої одиниці', () => {
    expect(formatDuration(0.4)).toBe('менше доби')
    expect(formatDuration(1)).toBe('1 день')
    expect(formatDuration(5)).toBe('5 днів')
    expect(formatDuration(20)).toBe('3 тижні')
    expect(formatDuration(95)).toBe('3 місяці')
  })
})

describe('forecast із нормою', () => {
  it('норма має пріоритет над журналом, навіть коли історії ще немає', () => {
    const f = forecast({ ...group(), total: 10, threshold: 2 }, [], now, { usage_qty: 1, usage_months: 1 })
    expect(f.perDay).toBeCloseTo(1 / 30.4375)
  })

  it('речі за графіком у «скоро закінчиться» не потрапляють', () => {
    const g = group({ total: 3, categoryId: 'c' })
    const cats = [{ id: 'c', scheduled: true, usage_qty: 1, usage_months: 1 }]
    expect(upcoming([g], steady, now, 14, cats)).toEqual([])
  })
})
