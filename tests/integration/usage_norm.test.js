import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

// Контракт міграції 0016: норма й заміна за графіком на підкатегорії.
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.TEST_EMAIL
const password = process.env.TEST_PASSWORD

const ready = Boolean(url && key && email && password)
const maybe = ready ? describe : describe.skip

maybe('норма витрачання', () => {
  let db
  let userId
  const created = []

  beforeAll(async () => {
    db = createClient(url, key)
    const { error } = await db.auth.signInWithPassword({ email, password })
    if (error) throw error
    userId = (await db.auth.getUser()).data.user.id
  })

  afterAll(async () => {
    if (created.length) await db.from('categories').delete().in('id', created)
  })

  it('норма, графік і дата заміни зберігаються', async () => {
    const { data, error } = await db.from('categories').insert({
      user_id: userId, name: `тест норми ${Date.now()}`, sort_order: 999,
      usage_qty: 1, usage_months: 3, scheduled: true, replaced_on: '2026-09-01',
    }).select().single()
    expect(error).toBeNull()
    created.push(data.id)
    expect(Number(data.usage_qty)).toBe(1)
    expect(Number(data.usage_months)).toBe(3)
    expect(data.scheduled).toBe(true)
    expect(data.replaced_on).toBe('2026-09-01')
  })

  it('нульова норма відхиляється', async () => {
    const { error } = await db.from('categories').insert({
      user_id: userId, name: `тест нуля ${Date.now()}`, sort_order: 999, usage_months: 0,
    })
    expect(error).not.toBeNull()
  })
})
