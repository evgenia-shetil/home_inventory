import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.TEST_EMAIL
const password = process.env.TEST_PASSWORD

// Без доступу до бази тести пропускаються, а не падають:
// у CI секретів тестового користувача немає.
const ready = Boolean(url && key && email && password)
const maybe = ready ? describe : describe.skip

maybe('adjust_quantity', () => {
  let db
  let itemId

  beforeAll(async () => {
    db = createClient(url, key)
    const { error } = await db.auth.signInWithPassword({ email, password })
    if (error) throw error

    const { data: userData } = await db.auth.getUser()
    const { data, error: insErr } = await db
      .from('items')
      .insert({
        user_id: userData.user.id,
        name: 'тестовий товар',
        qty: 3,
        unit: 'шт',
        threshold: 1,
      })
      .select()
      .single()
    if (insErr) throw insErr
    itemId = data.id
  })

  afterAll(async () => {
    if (itemId) await db.from('items').delete().eq('id', itemId)
  })

  it('віднімає одиницю і пише подію consume', async () => {
    const { data, error } = await db.rpc('adjust_quantity', {
      p_item_id: itemId, p_delta: -1, p_kind: 'consume',
    })
    expect(error).toBeNull()
    expect(Number(data.qty)).toBe(2)

    const { data: events } = await db
      .from('events').select('*').eq('item_id', itemId)
      .order('created_at', { ascending: false }).limit(1)
    expect(events[0].kind).toBe('consume')
    expect(Number(events[0].delta)).toBe(-1)
  })

  it('не опускається нижче нуля і логує фактичну зміну', async () => {
    const { data } = await db.rpc('adjust_quantity', {
      p_item_id: itemId, p_delta: -100, p_kind: 'consume',
    })
    expect(Number(data.qty)).toBe(0)

    const { data: events } = await db
      .from('events').select('*').eq('item_id', itemId)
      .order('created_at', { ascending: false }).limit(1)
    expect(Number(events[0].delta)).toBe(-2)
  })

  it('поповнення оновлює ціну і місце', async () => {
    const { data } = await db.rpc('adjust_quantity', {
      p_item_id: itemId, p_delta: 5, p_kind: 'restock',
      p_price: 42.5, p_place: 'АТБ',
    })
    expect(Number(data.qty)).toBe(5)
    expect(Number(data.last_price)).toBe(42.5)
    expect(data.last_place).toBe('АТБ')
  })

  it('відхиляє невідомий тип операції', async () => {
    const { error } = await db.rpc('adjust_quantity', {
      p_item_id: itemId, p_delta: 1, p_kind: 'вигадка',
    })
    expect(error).not.toBeNull()
  })

  it('забороняє прямий UPDATE кількості', async () => {
    const { error } = await db.from('items').update({ qty: 999 }).eq('id', itemId)
    expect(error).not.toBeNull()
  })

  it('переносить одиницю з шафи в користування, не міняючи суми', async () => {
    const { data: before } = await db.from('items').select('qty,in_use').eq('id', itemId).single()
    const sumBefore = Number(before.qty) + Number(before.in_use)

    const { data, error } = await db.rpc('adjust_quantity', {
      p_item_id: itemId, p_delta: 1, p_kind: 'open', p_bucket: 'move',
    })
    expect(error).toBeNull()
    expect(Number(data.qty)).toBe(Number(before.qty) - 1)
    expect(Number(data.in_use)).toBe(Number(before.in_use) + 1)
    expect(Number(data.qty) + Number(data.in_use)).toBe(sumBefore)
  })

  it('списує з користування окремо від шафи', async () => {
    const { data: before } = await db.from('items').select('qty,in_use').eq('id', itemId).single()
    const { data } = await db.rpc('adjust_quantity', {
      p_item_id: itemId, p_delta: -1, p_kind: 'consume', p_bucket: 'in_use',
    })
    expect(Number(data.in_use)).toBe(Number(before.in_use) - 1)
    expect(Number(data.qty)).toBe(Number(before.qty))
  })

  it('не переносить більше, ніж є в шафі', async () => {
    const { data } = await db.rpc('adjust_quantity', {
      p_item_id: itemId, p_delta: 999, p_kind: 'open', p_bucket: 'move',
    })
    expect(Number(data.qty)).toBe(0)

    const { data: events } = await db
      .from('events').select('delta,bucket').eq('item_id', itemId)
      .order('created_at', { ascending: false }).limit(1)
    // У журнал іде фактично перенесене, а не запитане
    expect(Number(events[0].delta)).toBeLessThan(999)
    expect(events[0].bucket).toBe('move')
  })

  it('відхиляє невідомий лічильник', async () => {
    const { error } = await db.rpc('adjust_quantity', {
      p_item_id: itemId, p_delta: 1, p_kind: 'restock', p_bucket: 'вигадка',
    })
    expect(error).not.toBeNull()
  })
})
