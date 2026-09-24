import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

// Справжній Postgres у WebAssembly з усіма міграціями по порядку. Дає
// перевіряти базу — RLS, права на стовпці, функції, відновлення з копії —
// без мережі й без секретів, тож і в CI. Інтеграційні тести проти живої
// бази лишаються: вони ловлять те, чим Supabase відрізняється від заглушок.
const MIGRATIONS = fileURLToPath(new URL('../../supabase/migrations/', import.meta.url))

// Мінімум Supabase, на який спираються міграції: схеми auth і storage,
// ролі й auth.uid(), що читає ідентифікатор користувача з налаштування
// сеансу — так само, як справжній читає його з JWT.
const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (id uuid primary key, email text unique);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;

  create schema storage;
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text, name text
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant usage on schema storage to authenticated;
  grant all on storage.objects to authenticated;

  -- Типові права Supabase: ролі API бачать схему public, а обмежує їх RLS.
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`

export async function createDatabase({ upTo = Infinity } = {}) {
  // pgcrypto потрібен першій міграції; у Supabase він уже є.
  const db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(SUPABASE_STUBS)
  await migrate(db, { from: 1, upTo })
  return db
}

// Окремо, щоб перевіряти міграцію даних: створити стан «до», а потім
// накотити наступні міграції поверх нього.
export async function migrate(db, { from = 1, upTo = Infinity } = {}) {
  const files = readdirSync(MIGRATIONS).filter(f => /^\d{4}_.*\.sql$/.test(f)).sort()
  for (const file of files) {
    const n = Number(file.slice(0, 4))
    if (n < from) continue
    if (n > upTo) break
    try {
      await db.exec(readFileSync(MIGRATIONS + file, 'utf8'))
    } catch (err) {
      throw new Error(`${file}: ${err.message}`)
    }
  }
}

export async function createUser(db, email) {
  const { rows } = await db.query(
    'insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id', [email])
  return rows[0].id
}

// Виконує запити від імені користувача, як запит із застосунку:
// роль authenticated, auth.uid() повертає його id, RLS діє.
export async function asUser(db, userId, fn) {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated;`)
  try {
    return await fn(db)
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`)
  }
}

export async function asAnon(db, fn) {
  await db.exec('set role anon;')
  try {
    return await fn(db)
  } finally {
    await db.exec('reset role;')
  }
}
