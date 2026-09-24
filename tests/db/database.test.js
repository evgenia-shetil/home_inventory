// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { createDatabase, migrate, createUser, asUser, asAnon } from './harness.js'

// Контракт бази без мережі: права, RLS, функції й міграції даних.
describe('база', () => {
  let db
  let alice
  let bob

  const insertItem = (who, fields) => asUser(db, who, async d => (await d.query(
    `insert into items (user_id, name, qty, unit, threshold) values ($1, $2, $3, 'шт', 1) returning *`,
    [who, fields.name, fields.qty ?? 0])).rows[0])

  const adjust = (who, itemId, delta, kind, bucket = 'stock') => asUser(db, who, async d => (await d.query(
    'select * from adjust_quantity($1, $2, $3, null, null, $4)', [itemId, delta, kind, bucket])).rows[0])

  beforeAll(async () => {
    db = await createDatabase()
    alice = await createUser(db, 'alice@test')
    bob = await createUser(db, 'bob@test')
  }, 60_000)

  describe('доступ', () => {
    it('чужі товари не видно', async () => {
      await insertItem(alice, { name: 'мило Аліси' })
      const rows = await asUser(db, bob, async d => (await d.query('select * from items')).rows)
      expect(rows.map(r => r.name)).not.toContain('мило Аліси')
    })

    it('анонім бачить порожньо, а не помилку', async () => {
      const rows = await asAnon(db, async d => (await d.query('select * from items')).rows)
      expect(rows).toEqual([])
    })

    it('кількість напряму не змінити', async () => {
      const item = await insertItem(alice, { name: 'щітка' })
      await expect(asUser(db, alice, d => d.query('update items set qty = 99 where id = $1', [item.id])))
        .rejects.toThrow(/permission denied/)
    })

    it('журнал напряму не дописати', async () => {
      const item = await insertItem(alice, { name: 'паста' })
      await expect(asUser(db, alice, d => d.query(
        `insert into events (user_id, item_id, delta, kind) values ($1, $2, 5, 'restock')`, [alice, item.id])))
        .rejects.toThrow()
    })

    it('чужим товаром не покерувати через функцію', async () => {
      const item = await insertItem(alice, { name: 'гель' })
      await expect(adjust(bob, item.id, 1, 'restock')).rejects.toThrow(/товар не знайдено/)
    })
  })

  describe('журнал повний', () => {
    it('новий товар: початковий залишок записується подією', async () => {
      const item = await insertItem(alice, { name: 'рулони', qty: 0 })
      await adjust(alice, item.id, 6, 'opening')
      await adjust(alice, item.id, -2, 'consume')
      await adjust(alice, item.id, 1, 'open', 'move')
      const bad = await asUser(db, alice, async d => (await d.query('select * from journal_mismatches()')).rows)
      expect(bad.filter(r => r.item_id === item.id)).toEqual([])
    })

    it('переведення в упаковки не ламає суму журналу', async () => {
      const item = await asUser(db, alice, async d => (await d.query(
        `insert into items (user_id, name, qty, unit, threshold) values ($1, 'шампунь', 0, 'мл', 1) returning *`,
        [alice])).rows[0])
      await adjust(alice, item.id, 1000, 'opening')
      await adjust(alice, item.id, 500, 'open', 'move')
      const converted = await asUser(db, alice, async d => (await d.query(
        'select * from convert_to_packs($1, 500)', [item.id])).rows[0])
      expect(Number(converted.qty)).toBe(1)
      expect(Number(converted.in_use)).toBe(1)
      const bad = await asUser(db, alice, async d => (await d.query('select * from journal_mismatches()')).rows)
      expect(bad.filter(r => r.item_id === item.id)).toEqual([])
    })

    it('перевірка бачить лише свої товари', async () => {
      const rows = await asUser(db, bob, async d => (await d.query('select * from journal_mismatches()')).rows)
      expect(rows).toEqual([])
    })
  })
})

describe('міграція 0017 дописує початкові залишки', () => {
  it('після неї полиця всіх товарів дорівнює сумі журналу', async () => {
    const db = await createDatabase({ upTo: 16 })
    const user = await createUser(db, 'old@test')

    // Стан до 0017: товар створено з кількістю без події, потім були
    // звичайні операції, частина — з користування.
    const item = await asUser(db, user, async d => (await d.query(
      `insert into items (user_id, name, qty, unit, threshold) values ($1, 'старий', 5, 'шт', 1) returning *`,
      [user])).rows[0])
    await asUser(db, user, async d => {
      await d.query(`select adjust_quantity($1, 2, 'open', null, null, 'move')`, [item.id])
      await d.query(`select adjust_quantity($1, -1, 'consume', null, null, 'in_use')`, [item.id])
      await d.query(`select adjust_quantity($1, 3, 'restock')`, [item.id])
    })

    await migrate(db, { from: 17 })

    const bad = await asUser(db, user, async d => (await d.query('select * from journal_mismatches()')).rows)
    expect(bad).toEqual([])
    const opening = await asUser(db, user, async d => (await d.query(
      `select delta, bucket from events where kind = 'opening' order by bucket`)).rows)
    expect(opening.map(r => [r.bucket, Number(r.delta)])).toEqual([['stock', 5]])
  }, 60_000)
})
