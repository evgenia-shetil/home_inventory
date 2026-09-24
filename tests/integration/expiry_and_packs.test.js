import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Контракт міграції 0015: списання, переведення в упаковки й нові стовпці.
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.TEST_EMAIL
const password = process.env.TEST_PASSWORD

const ready = Boolean(url && key && email && password)
const maybe = ready ? describe : describe.skip

maybe('терміни й фасування', () => {
  let db
  let userId
  const created = []

  async function makeItem(fields) {
    const { data, error } = await db.from('items')
      .insert({ user_id: userId, name: 'тестовий товар', threshold: 1, ...fields })
      .select().single()
    if (error) throw error
    created.push(data.id)
    return data
  }

  const lastEvent = async itemId => {
    const { data } = await db.from('events').select('*').eq('item_id', itemId)
      .order('created_at', { ascending: false }).limit(1)
    return data[0]
  }

  beforeAll(async () => {
    db = createClient(url, key)
    const { error } = await db.auth.signInWithPassword({ email, password })
    if (error) throw error
    userId = (await db.auth.getUser()).data.user.id
  })

  afterAll(async () => {
    if (created.length) await db.from('items').delete().in('id', created)
  })

  it('дату й фасування можна редагувати напряму', async () => {
    const item = await makeItem({ qty: 1, unit: 'шт' })
    const { data, error } = await db.from('items')
      .update({ expires_on: '2027-01-31', pack_size: 250, pack_unit: 'мл' })
      .eq('id', item.id).select().single()
    expect(error).toBeNull()
    expect(data.expires_on).toBe('2027-01-31')
    expect(Number(data.pack_size)).toBe(250)
  })

  it('списання пише discard, а не витрату', async () => {
    const item = await makeItem({ qty: 3, unit: 'шт' })
    const { data, error } = await db.rpc('adjust_quantity', {
      p_item_id: item.id, p_delta: -3, p_kind: 'discard',
    })
    expect(error).toBeNull()
    expect(Number(data.qty)).toBe(0)
    expect((await lastEvent(item.id)).kind).toBe('discard')
  })

  it('переводить мілілітри в упаковки однією транзакцією', async () => {
    const item = await makeItem({ qty: 1000, unit: 'мл' })
    await db.rpc('adjust_quantity', { p_item_id: item.id, p_delta: 500, p_kind: 'restock', p_price: 0.2 })

    const { data, error } = await db.rpc('convert_to_packs', { p_item_id: item.id, p_pack_size: 500 })
    expect(error).toBeNull()
    expect(data.unit).toBe('шт')
    expect(Number(data.qty)).toBe(3)
    expect(Number(data.pack_size)).toBe(500)
    expect(data.pack_unit).toBe('мл')
    expect(Number(data.last_price)).toBe(100)

    const event = await lastEvent(item.id)
    expect(event.kind).toBe('unit')
    expect(Number(event.delta)).toBe(0)
    expect(event.note).toContain('1500 мл')
  })

  it('не переводить те, що вже рахується штуками', async () => {
    const item = await makeItem({ qty: 2, unit: 'шт' })
    const { error } = await db.rpc('convert_to_packs', { p_item_id: item.id, p_pack_size: 100 })
    expect(error?.message).toContain('упаковками')
  })

  it('кількість напряму й далі не змінити', async () => {
    const item = await makeItem({ qty: 2, unit: 'шт' })
    const { error } = await db.from('items').update({ qty: 99 }).eq('id', item.id)
    expect(error).not.toBeNull()
  })
})
