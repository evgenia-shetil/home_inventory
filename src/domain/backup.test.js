import { describe, it, expect } from 'vitest'
import { buildBackup, backupFilename, daysSince, BACKUP_FORMAT } from './backup.js'

describe('buildBackup', () => {
  const at = new Date('2026-09-24T10:00:00Z')

  it('кладе всі три набори й рахує рядки', () => {
    const backup = buildBackup({
      items: [{ id: 'i1', user_id: 'u', name: 'мило' }],
      categories: [{ id: 'c1', user_id: 'u', name: 'тіло' }],
      events: [{ id: 'e1', user_id: 'u', delta: -1 }, { id: 'e2', user_id: 'u', delta: 2 }],
      exportedAt: at,
    })
    expect(backup.format).toBe(BACKUP_FORMAT)
    expect(backup.exported_at).toBe('2026-09-24T10:00:00.000Z')
    expect(backup.counts).toEqual({ categories: 1, items: 1, events: 2 })
    expect(backup.items[0]).toEqual({ id: 'i1', name: 'мило' })
  })

  it('прибирає user_id з усіх рядків', () => {
    const backup = buildBackup({ items: [{ id: 'i1', user_id: 'u' }], exportedAt: at })
    expect(JSON.stringify(backup)).not.toContain('user_id')
  })

  it('порожній облік — теж валідна копія', () => {
    expect(buildBackup({ exportedAt: at }).counts).toEqual({ categories: 0, items: 0, events: 0 })
  })
})

describe('backupFilename', () => {
  it('дата в назві з нулями попереду', () => {
    expect(backupFilename(new Date(2026, 0, 5))).toBe('zapasy-2026-01-05.json')
  })
})

describe('daysSince', () => {
  const now = new Date('2026-09-24T12:00:00Z')

  it('рахує повні дні', () => {
    expect(daysSince('2026-09-20T13:00:00Z', now)).toBe(3)
  })

  it('без дати або з поганою датою — null', () => {
    expect(daysSince(null, now)).toBeNull()
    expect(daysSince('не дата', now)).toBeNull()
  })
})
