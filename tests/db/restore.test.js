// @vitest-environment node
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { createDatabase, createUser, asUser } from './harness.js'
import { buildBackup } from '../../src/domain/backup.js'
import { buildRestoreSql } from '../../scripts/lib/restore.mjs'

// Репетиція відновлення: копія, яку ніколи не відновлювали, — ще не копія.
// Облік одного акаунта → файл копії (той самий код, що в застосунку) →
// SQL зі скрипта → інший акаунт. Має збігтись усе, до журналу.
describe('відновлення з резервної копії', () => {
  let db
  let source
  let backup

  const rowsOf = async (table, userId) =>
    (await db.query(`select * from ${table} where user_id = $1 order by created_at, id`, [userId])).rows

  beforeAll(async () => {
    db = await createDatabase()
    source = await createUser(db, 'source@test')

    await asUser(db, source, async d => {
      await d.query('select ensure_default_categories()')
      const cat = (await d.query(`select id from categories where parent_id is not null limit 1`)).rows[0].id
      const item = (await d.query(
        `insert into items (user_id, name, qty, unit, threshold, category_id, expires_on, pack_size, pack_unit)
         values ($1, 'Шампунь "лапки" $zapasy$', 0, 'шт', 1, $2, '2027-01-01', 400, 'мл') returning id`,
        [source, cat])).rows[0].id
      await d.query(`select adjust_quantity($1, 3, 'opening')`, [item])
      await d.query(`select adjust_quantity($1, 2, 'restock', 210, 'Сільпо')`, [item])
      await d.query(`select adjust_quantity($1, 1, 'open', null, null, 'move')`, [item])
      await d.query(`select adjust_quantity($1, -1, 'consume', null, null, 'in_use')`, [item])
      await d.query(`update categories set usage_qty = 1, usage_months = 2, scheduled = true,
                     replaced_on = '2026-09-01' where id = $1`, [cat])
    })

    // Копія знімається так само, як у застосунку: рядки таблиць без user_id.
    backup = JSON.parse(JSON.stringify(buildBackup({
      categories: await rowsOf('categories', source),
      items: await rowsOf('items', source),
      events: await rowsOf('events', source),
    })))
  }, 60_000)

  // Відмова всередині транзакції лишає зʼєднання в перерваній транзакції;
  // без відкату наступний тест падав би з чужої причини.
  afterEach(async () => { await db.exec('rollback') })

  it('відновлює все в порожній акаунт, навіть після першого входу', async () => {
    const target = await createUser(db, 'target@test')
    // Перший вхід уже створив стартові категорії — відновлення їх замінює.
    await asUser(db, target, d => d.query('select ensure_default_categories()'))

    await db.exec(buildRestoreSql(backup, 'target@test'))

    // id нові, тож порівнюємо зміст і звʼязки через назви.
    const view = async userId => {
      const cats = await rowsOf('categories', userId)
      const items = await rowsOf('items', userId)
      const catName = id => cats.find(c => c.id === id)?.name ?? null
      const itemName = id => items.find(i => i.id === id)?.name ?? null
      // Однакові назви законні під різними батьками («сонцезахист»), тож і батько в ключі.
      const byName = (a, b) => a.name.localeCompare(b.name) || String(a.parent).localeCompare(String(b.parent))
      return {
        categories: cats.map(({ id: _i, user_id: _u, parent_id, ...rest }) => ({ ...rest, parent: catName(parent_id) })).sort(byName),
        items: items.map(({ id: _i, user_id: _u, photo_path: _p, category_id, ...rest }) => ({ ...rest, category: catName(category_id) })),
        events: (await rowsOf('events', userId))
          .map(({ id: _i, user_id: _u, item_id, ...rest }) => ({ ...rest, item: itemName(item_id) })),
      }
    }
    const [restored, original] = [await view(target), await view(source)]
    expect(restored.categories).toEqual(original.categories)
    expect(restored.items).toEqual(original.items)
    expect(restored.events).toEqual(original.events)
    expect(restored.events.length).toBe(4)
  })

  it('відновлений облік проходить перевірку журналу', async () => {
    const target = (await db.query(`select id from auth.users where email = 'target@test'`)).rows[0].id
    const bad = await asUser(db, target, async d => (await d.query('select * from journal_mismatches()')).rows)
    expect(bad).toEqual([])
  })

  it('не зливає копію з наявним обліком', async () => {
    const busy = await createUser(db, 'busy@test')
    await asUser(db, busy, d => d.query(
      `insert into items (user_id, name, qty, unit, threshold) values ($1, 'своє', 0, 'шт', 1)`, [busy]))
    await expect(db.exec(buildRestoreSql(backup, 'busy@test'))).rejects.toThrow(/порожній акаунт/)
  })

  it('невідомий акаунт — зрозуміла відмова', async () => {
    await expect(db.exec(buildRestoreSql(backup, 'nobody@test'))).rejects.toThrow(/не знайдено/)
  })

  it('не приймає чужий файл', () => {
    expect(() => buildRestoreSql({ format: 'щось інше' }, 'a@b')).toThrow(/не файл копії/)
  })
})
