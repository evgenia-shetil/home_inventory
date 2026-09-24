import { describe, it, expect } from 'vitest'
import { expiryState, expiringItems, describeExpiry, mergeExpiry, localDate } from './expiry.js'

const today = '2026-09-24'
const item = over => ({ id: 'a', qty: 1, in_use: 0, expires_on: null, ...over })

describe('expiryState', () => {
  it('без дати сигналу немає', () => {
    expect(expiryState(item(), today)).toBeNull()
  })

  it('минула дата — прострочено', () => {
    expect(expiryState(item({ expires_on: '2026-09-20' }), today)).toEqual({ state: 'expired', days: -4 })
  })

  it('сьогоднішня дата ще придатна', () => {
    expect(expiryState(item({ expires_on: today }), today)).toEqual({ state: 'soon', days: 0 })
  })

  it('за межами місяця — все гаразд', () => {
    expect(expiryState(item({ expires_on: '2026-12-01' }), today).state).toBe('ok')
  })

  it('річ, якої немає, не псується', () => {
    expect(expiryState(item({ qty: 0, expires_on: '2026-09-01' }), today)).toBeNull()
  })

  it('відкрита річ у користуванні теж псується', () => {
    expect(expiryState(item({ qty: 0, in_use: 1, expires_on: '2026-09-01' }), today).state).toBe('expired')
  })
})

describe('expiringItems', () => {
  it('спершу прострочене, далі за датою, без придатного', () => {
    const list = expiringItems([
      item({ id: 'later', expires_on: '2026-10-10' }),
      item({ id: 'ok', expires_on: '2027-01-01' }),
      item({ id: 'gone', expires_on: '2026-09-01' }),
    ], today)
    expect(list.map(x => x.item.id)).toEqual(['gone', 'later'])
  })
})

describe('describeExpiry', () => {
  it('людською мовою з правильною множиною', () => {
    expect(describeExpiry({ state: 'expired', days: -2 })).toBe('прострочено 2 дні тому')
    expect(describeExpiry({ state: 'expired', days: -11 })).toBe('прострочено 11 днів тому')
    expect(describeExpiry({ state: 'soon', days: 0 })).toBe('останній день')
    expect(describeExpiry({ state: 'soon', days: 1 })).toBe('до завтра')
    expect(describeExpiry({ state: 'soon', days: 21 })).toBe('ще 21 день')
  })
})

describe('mergeExpiry', () => {
  it('тримає найближчу дату, поки старий запас є', () => {
    expect(mergeExpiry('2026-10-01', '2027-01-01', 2)).toBe('2026-10-01')
    expect(mergeExpiry('2027-01-01', '2026-10-01', 2)).toBe('2026-10-01')
  })

  it('без старого запасу бере нову дату', () => {
    expect(mergeExpiry('2026-01-01', '2027-01-01', 0)).toBe('2027-01-01')
  })

  it('без нової дати лишає стару', () => {
    expect(mergeExpiry('2026-10-01', '', 2)).toBe('2026-10-01')
  })
})

describe('localDate', () => {
  it('місцева дата без часу', () => {
    expect(localDate(new Date(2026, 8, 4, 23, 30))).toBe('2026-09-04')
  })
})
