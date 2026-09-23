# Домашній трекер запасів — план реалізації

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA для обліку домашніх запасів із оновленням кількості в один тап, синхронізацією між пристроями та журналом операцій.

**Architecture:** Статичний React-фронтенд звертається до Supabase напряму. Власного серверного коду немає. Уся цілісність даних забезпечується в базі: зміна кількості можлива лише через RPC-функцію `adjust_quantity`, яка однією транзакцією оновлює товар і пише подію; доступ обмежено RLS-політиками та column-level grants.

**Tech Stack:** React 18, Vite 5, react-router-dom (HashRouter), @supabase/supabase-js v2, Vitest, GitHub Actions → GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-23-home-inventory-design.md`

## Global Constraints

- Supabase Project URL: `https://mawrpovdtaidhncwktfx.supabase.co`
- GitHub repo: `https://github.com/evgenia-shetil/home_inventory`
- Vite `base`: `/home_inventory/` — сайт живе в підпапці на GitHub Pages
- Роутинг: **лише** `HashRouter`. `BrowserRouter` дає 404 при прямому відкритті сторінки на Pages
- У фронтенд потрапляє **тільки** `anon` ключ. `service_role` не використовується ніде
- Грошові й кількісні поля в БД — тип `numeric`, ніколи `float`/`double precision`
- Категорії за замовчуванням: `прибирання`, `тіло`, `обличчя`, `ліки`
- Мова інтерфейсу — українська
- Одиниці виміру за замовчуванням: `шт`, `кг`, `г`, `л`, `мл`, `пачка`, `рулон`
- Всі таблиці мають `user_id uuid not null references auth.users(id) on delete cascade`
- Кількість ніколи не опускається нижче нуля

---

## File Structure

```
supabase/migrations/
  0001_schema.sql              — таблиці categories, items, events
  0002_rls.sql                 — RLS-політики та column grants
  0003_adjust_quantity.sql     — RPC зміни кількості
  0004_default_categories.sql  — RPC створення категорій за замовчуванням
  0005_storage.sql             — бакет photos і політики доступу

scripts/
  verify-rls.mjs               — перевірка, що анонім не бачить даних

src/
  main.jsx                     — точка входу, роутер
  App.jsx                      — каркас: AuthGate + маршрути + нижня навігація
  lib/
    supabase.js                — клієнт-синглтон
    format.js                  — форматування кількості та цін
  domain/                      — чиста логіка без мережі, вся покрита тестами
    sorting.js                 — sortByUrgency
    optimistic.js              — applyDelta
    image.js                   — compressImage
  data/
    InventoryContext.jsx       — стан items/categories + мутації
  ui/
    States.jsx                 — Skeleton, Empty, ErrorState
    ItemCard.jsx               — картка товару з кнопкою «−1»
    CategoryStrip.jsx          — горизонтальна стрічка категорій
    BottomNav.jsx              — нижня навігація
    UndoToast.jsx              — плашка скасування
    NetworkBanner.jsx          — плашка «немає зв'язку»
  screens/
    LoginScreen.jsx
    StockScreen.jsx
    ItemScreen.jsx
    AddItemScreen.jsx
    ShoppingScreen.jsx
  styles.css

public/
  manifest.webmanifest
  icon-192.png
  icon-512.png

.github/workflows/deploy.yml
vite.config.js
.env.example
```

Розділення за відповідальністю, не за технічним шаром: `domain/` — чисті функції, які тестуються без браузера й мережі; `data/` — єдине місце, де відбуваються звернення до Supabase; `ui/` та `screens/` — відображення.

---

### Task 1: Каркас проєкту

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `.env.example`, `src/main.jsx`, `src/App.jsx`, `src/styles.css`
- Create: `src/domain/sorting.test.js` (тимчасовий димовий тест)

**Interfaces:**
- Consumes: нічого
- Produces: робоча збірка Vite з `base: '/home_inventory/'`; команди `npm run dev`, `npm run build`, `npm test`

- [ ] **Step 1: Ініціалізувати проєкт і залежності**

```bash
cd "/Users/yevheniia/Downloads/Home inventory"
npm init -y
npm install react react-dom react-router-dom @supabase/supabase-js
npm install -D vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 2: Налаштувати package.json**

Замінити поле `scripts` і додати `type`:

```json
{
  "name": "home-inventory",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 3: Створити vite.config.js**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/home_inventory/',
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 4: Створити index.html**

```html
<!doctype html>
<html lang="uk">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1c1b1a" />
    <title>Запаси</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Створити .env.example і .env**

`.env.example`:

```
VITE_SUPABASE_URL=https://mawrpovdtaidhncwktfx.supabase.co
VITE_SUPABASE_ANON_KEY=
```

Скопіювати у `.env` і вписати реальний anon key. `.env` вже в `.gitignore`.

- [ ] **Step 6: Створити мінімальні main.jsx, App.jsx, styles.css**

`src/main.jsx`:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
```

`src/App.jsx`:

```jsx
export default function App() {
  return <main className="screen"><h1>Запаси</h1></main>
}
```

`src/styles.css`:

```css
:root {
  --bg: #faf9f7;
  --surface: #ffffff;
  --text: #1c1b1a;
  --muted: #7a7570;
  --line: #e7e3de;
  --accent: #2f6d5b;
  --warn: #b4531f;
  --radius: 14px;
  --nav-h: 60px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font: 16px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.screen {
  padding: 16px 16px calc(var(--nav-h) + env(safe-area-inset-bottom) + 16px);
  max-width: 720px;
  margin: 0 auto;
}
```

- [ ] **Step 7: Написати димовий тест**

`src/domain/sorting.test.js`:

```js
import { describe, it, expect } from 'vitest'

describe('каркас', () => {
  it('тести запускаються', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 8: Перевірити збірку і тести**

```bash
npm test
npm run build
```

Очікується: тест PASS, збірка успішна, у `dist/index.html` шляхи починаються з `/home_inventory/`.

- [ ] **Step 9: Коміт**

```bash
git add -A
git commit -m "feat: каркас Vite + React + Vitest з base для GitHub Pages"
```

---

### Task 2: Схема бази даних і RLS

**Files:**
- Create: `supabase/migrations/0001_schema.sql`
- Create: `supabase/migrations/0002_rls.sql`
- Create: `scripts/verify-rls.mjs`

**Interfaces:**
- Consumes: нічого
- Produces: таблиці `public.categories`, `public.items`, `public.events` зі стовпцями згідно зі специфікацією; RLS увімкнено; `UPDATE` на `items.qty` заборонено для ролі `authenticated`

- [ ] **Step 1: Написати міграцію схеми**

`supabase/migrations/0001_schema.sql`:

```sql
create extension if not exists "pgcrypto";

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

create table public.items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  category_id uuid references public.categories(id) on delete set null,
  photo_path  text,
  qty         numeric not null default 0 check (qty >= 0),
  unit        text    not null default 'шт',
  threshold   numeric not null default 1 check (threshold >= 0),
  last_price  numeric check (last_price >= 0),
  last_place  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  item_id    uuid not null references public.items(id) on delete cascade,
  delta      numeric not null,
  kind       text not null check (kind in ('consume','restock','correction')),
  price      numeric check (price >= 0),
  place      text,
  created_at timestamptz not null default now()
);

create index items_user_idx      on public.items(user_id);
create index items_category_idx  on public.items(category_id);
create index events_item_idx     on public.events(item_id, created_at desc);
create index categories_user_idx on public.categories(user_id, sort_order);
```

- [ ] **Step 2: Написати міграцію RLS**

`supabase/migrations/0002_rls.sql`:

```sql
alter table public.categories enable row level security;
alter table public.items      enable row level security;
alter table public.events     enable row level security;

create policy categories_own on public.categories
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy items_own on public.items
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Журнал лише читається з клієнта. Запис робить виключно adjust_quantity.
create policy events_read_own on public.events
  for select to authenticated
  using (user_id = auth.uid());

-- Кількість не можна змінити напряму: RLS не вміє обмежувати стовпці,
-- тому обмеження ставиться через column-level grant.
revoke update on public.items from authenticated;
grant update (name, category_id, photo_path, unit, threshold, last_place, last_price)
  on public.items to authenticated;
```

- [ ] **Step 3: Застосувати міграції**

Відкрити Supabase → SQL Editor, виконати вміст `0001_schema.sql`, потім `0002_rls.sql`.
Очікується: три таблиці у Table Editor, у кожної позначка RLS enabled.

- [ ] **Step 4: Написати скрипт перевірки доступу**

`scripts/verify-rls.mjs`:

```js
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Немає VITE_SUPABASE_URL або VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const anon = createClient(url, key)
let failed = false

for (const table of ['categories', 'items', 'events']) {
  const { data, error } = await anon.from(table).select('*').limit(1)
  const rows = data?.length ?? 0
  if (rows > 0) {
    console.error(`ПРОВАЛ: ${table} віддає дані анонімному клієнту`)
    failed = true
  } else {
    console.log(`ok: ${table} — порожньо (${error ? error.code : 'без помилки'})`)
  }
}

process.exit(failed ? 1 : 0)
```

- [ ] **Step 5: Запустити перевірку**

```bash
node --env-file=.env scripts/verify-rls.mjs
```

Очікується: три рядки `ok`, код виходу 0. Якщо хоч одна таблиця віддала рядок — RLS налаштовано неправильно, далі не йти.

- [ ] **Step 6: Коміт**

```bash
git add supabase/migrations scripts/verify-rls.mjs
git commit -m "feat: схема БД, RLS-політики та перевірка анонімного доступу"
```

---

### Task 3: RPC зміни кількості

**Files:**
- Create: `supabase/migrations/0003_adjust_quantity.sql`
- Create: `supabase/migrations/0004_default_categories.sql`
- Create: `tests/integration/adjust_quantity.test.js`

**Interfaces:**
- Consumes: таблиці з Task 2
- Produces:
  - `adjust_quantity(p_item_id uuid, p_delta numeric, p_kind text, p_price numeric default null, p_place text default null) returns public.items`
  - `ensure_default_categories() returns void`

- [ ] **Step 1: Написати функцію adjust_quantity**

`supabase/migrations/0003_adjust_quantity.sql`:

```sql
create or replace function public.adjust_quantity(
  p_item_id uuid,
  p_delta   numeric,
  p_kind    text,
  p_price   numeric default null,
  p_place   text    default null
) returns public.items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_old_qty numeric;
  v_new_qty numeric;
  v_item    public.items;
begin
  if v_uid is null then
    raise exception 'не авторизовано';
  end if;

  if p_kind not in ('consume','restock','correction') then
    raise exception 'невідомий тип операції: %', p_kind;
  end if;

  -- Блокування рядка робить операцію безпечною при одночасних тапах
  -- з різних пристроїв: другий чекає, а не читає застаріле значення.
  select qty into v_old_qty
    from public.items
   where id = p_item_id and user_id = v_uid
   for update;

  if not found then
    raise exception 'товар не знайдено';
  end if;

  v_new_qty := greatest(v_old_qty + p_delta, 0);

  update public.items
     set qty        = v_new_qty,
         last_price = coalesce(p_price, last_price),
         last_place = coalesce(nullif(p_place, ''), last_place),
         updated_at = now()
   where id = p_item_id
   returning * into v_item;

  -- У журнал пишеться фактично застосована зміна, а не запитана:
  -- якщо спрацювало обмеження нулем, історія має відображати реальність.
  insert into public.events (user_id, item_id, delta, kind, price, place)
  values (v_uid, p_item_id, v_new_qty - v_old_qty, p_kind, p_price, nullif(p_place, ''));

  return v_item;
end;
$$;

revoke all on function public.adjust_quantity(uuid, numeric, text, numeric, text) from public;
grant execute on function public.adjust_quantity(uuid, numeric, text, numeric, text) to authenticated;
```

- [ ] **Step 2: Написати функцію категорій за замовчуванням**

`supabase/migrations/0004_default_categories.sql`:

```sql
create or replace function public.ensure_default_categories()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'не авторизовано';
  end if;

  insert into public.categories (user_id, name, sort_order)
  values (v_uid, 'прибирання', 1),
         (v_uid, 'тіло',       2),
         (v_uid, 'обличчя',    3),
         (v_uid, 'ліки',       4)
  on conflict (user_id, name) do nothing;
end;
$$;

revoke all on function public.ensure_default_categories() from public;
grant execute on function public.ensure_default_categories() to authenticated;
```

- [ ] **Step 3: Застосувати міграції**

Виконати обидва файли в Supabase SQL Editor.
Очікується: у Database → Functions видно `adjust_quantity` та `ensure_default_categories`.

- [ ] **Step 4: Написати інтеграційний тест**

`tests/integration/adjust_quantity.test.js`:

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const email = process.env.TEST_EMAIL
const password = process.env.TEST_PASSWORD

const ready = Boolean(url && key && email && password)
const maybe = ready ? describe : describe.skip

maybe('adjust_quantity', () => {
  let db
  let itemId

  beforeAll(async () => {
    db = createClient(url, key)
    const { error } = await db.auth.signInWithPassword({ email, password })
    if (error) throw error

    const { data, error: insErr } = await db
      .from('items')
      .insert({
        user_id: (await db.auth.getUser()).data.user.id,
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
})
```

- [ ] **Step 5: Створити тестового користувача і запустити тест**

У Supabase → Authentication → Users → Add user створити користувача з паролем (лише для тестів). Додати у `.env`:

```
TEST_EMAIL=test@example.com
TEST_PASSWORD=<пароль>
```

```bash
node --env-file=.env node_modules/vitest/vitest.mjs run tests/integration
```

Очікується: 5 тестів PASS. Останній тест — ключовий: він доводить, що обійти журнал неможливо.

- [ ] **Step 6: Коміт**

```bash
git add supabase/migrations tests/integration
git commit -m "feat: RPC adjust_quantity і категорії за замовчуванням з інтеграційними тестами"
```

---

### Task 4: Сортування за терміновістю

**Files:**
- Create: `src/domain/sorting.js`
- Modify: `src/domain/sorting.test.js` (замінити димовий тест)

**Interfaces:**
- Consumes: нічого
- Produces: `sortByUrgency(items: Item[]): Item[]`, `isLow(item: Item): boolean`

- [ ] **Step 1: Написати падаючі тести**

`src/domain/sorting.test.js` — замінити весь вміст:

```js
import { describe, it, expect } from 'vitest'
import { sortByUrgency, isLow } from './sorting.js'

const item = (name, qty, threshold) => ({ id: name, name, qty, threshold })

describe('sortByUrgency', () => {
  it('ставить попереду те, що ближче до порога у відносному вимірі', () => {
    const items = [
      item('сіль', 1, 1),     // 1.0
      item('папір', 4, 10),   // 0.4
      item('мило', 3, 2),     // 1.5
    ]
    expect(sortByUrgency(items).map(i => i.name)).toEqual(['папір', 'сіль', 'мило'])
  })

  it('не ділить на нуль при нульовому порозі', () => {
    const items = [item('а', 5, 0), item('б', 1, 1)]
    expect(() => sortByUrgency(items)).not.toThrow()
    expect(sortByUrgency(items).map(i => i.name)).toEqual(['б', 'а'])
  })

  it('при однаковій терміновості сортує за назвою українською', () => {
    const items = [item('яблуко', 1, 1), item('банан', 1, 1), item('їжак', 1, 1)]
    expect(sortByUrgency(items).map(i => i.name)).toEqual(['банан', 'їжак', 'яблуко'])
  })

  it('не мутує вхідний масив', () => {
    const items = [item('б', 5, 1), item('а', 1, 1)]
    const copy = [...items]
    sortByUrgency(items)
    expect(items).toEqual(copy)
  })
})

describe('isLow', () => {
  it('вважає низьким, коли кількість не більша за поріг', () => {
    expect(isLow(item('а', 1, 1))).toBe(true)
    expect(isLow(item('а', 0, 1))).toBe(true)
    expect(isLow(item('а', 2, 1))).toBe(false)
  })
})
```

- [ ] **Step 2: Запустити тести — мають впасти**

```bash
npm test
```

Очікується: FAIL, `Failed to resolve import "./sorting.js"`.

- [ ] **Step 3: Реалізувати**

`src/domain/sorting.js`:

```js
// Терміновість — відносна, а не абсолютна: товар з порогом 10 і залишком 4
// потребує уваги більше, ніж той, де лишилась одна одиниця з однієї.
function urgency(item) {
  const threshold = Number(item.threshold) > 0 ? Number(item.threshold) : 1
  return Number(item.qty) / threshold
}

export function isLow(item) {
  return Number(item.qty) <= Number(item.threshold)
}

export function sortByUrgency(items) {
  return [...items].sort(
    (a, b) => urgency(a) - urgency(b) || a.name.localeCompare(b.name, 'uk')
  )
}
```

- [ ] **Step 4: Запустити тести — мають пройти**

```bash
npm test
```

Очікується: 5 тестів PASS.

- [ ] **Step 5: Коміт**

```bash
git add src/domain/sorting.js src/domain/sorting.test.js
git commit -m "feat: сортування за відносною терміновістю"
```

---

### Task 5: Оптимістична зміна кількості

**Files:**
- Create: `src/domain/optimistic.js`
- Create: `src/domain/optimistic.test.js`

**Interfaces:**
- Consumes: нічого
- Produces: `applyDelta(items, itemId, delta): { items, applied }`

- [ ] **Step 1: Написати падаючі тести**

`src/domain/optimistic.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { applyDelta } from './optimistic.js'

const list = () => [
  { id: 'a', name: 'а', qty: 3 },
  { id: 'b', name: 'б', qty: 0 },
]

describe('applyDelta', () => {
  it('змінює кількість потрібного товару', () => {
    const { items } = applyDelta(list(), 'a', -1)
    expect(items.find(i => i.id === 'a').qty).toBe(2)
    expect(items.find(i => i.id === 'b').qty).toBe(0)
  })

  it('повертає фактично застосовану зміну', () => {
    const { applied } = applyDelta(list(), 'a', -1)
    expect(applied).toBe(-1)
  })

  it('обмежує нулем і повертає урізану зміну', () => {
    const { items, applied } = applyDelta(list(), 'b', -5)
    expect(items.find(i => i.id === 'b').qty).toBe(0)
    expect(applied).toBe(0)
  })

  // Головний тест цього модуля. Відкат має скасовувати саме те,
  // що було застосовано, а не повертати запам'ятоване значення —
  // інакше паралельний тап, що встиг пройти, буде затертий.
  it('відкат зворотною зміною не затирає паралельний тап', () => {
    const first = applyDelta(list(), 'a', -1)          // 3 -> 2
    const second = applyDelta(first.items, 'a', -1)    // 2 -> 1
    const reverted = applyDelta(second.items, 'a', -first.applied) // +1 -> 2
    expect(reverted.items.find(i => i.id === 'a').qty).toBe(2)
  })

  it('відкат урізаної зміни нічого не додає', () => {
    const applyResult = applyDelta(list(), 'b', -5)
    const reverted = applyDelta(applyResult.items, 'b', -applyResult.applied)
    expect(reverted.items.find(i => i.id === 'b').qty).toBe(0)
  })

  it('не мутує вхідний масив', () => {
    const items = list()
    const copy = JSON.parse(JSON.stringify(items))
    applyDelta(items, 'a', -1)
    expect(items).toEqual(copy)
  })

  it('ігнорує невідомий id', () => {
    const { items, applied } = applyDelta(list(), 'немає', -1)
    expect(applied).toBe(0)
    expect(items.map(i => i.qty)).toEqual([3, 0])
  })
})
```

- [ ] **Step 2: Запустити тести — мають впасти**

```bash
npm test
```

Очікується: FAIL, модуль не знайдено.

- [ ] **Step 3: Реалізувати**

`src/domain/optimistic.js`:

```js
// Повертає новий список і фактично застосовану зміну.
// Фактична зміна потрібна для відкату: відкочувати треба саме її
// (зворотною операцією), а не повертати запам'ятоване значення.
export function applyDelta(items, itemId, delta) {
  let applied = 0

  const next = items.map(item => {
    if (item.id !== itemId) return item
    const newQty = Math.max(0, Number(item.qty) + Number(delta))
    applied = newQty - Number(item.qty)
    return { ...item, qty: newQty }
  })

  return { items: next, applied }
}
```

- [ ] **Step 4: Запустити тести — мають пройти**

```bash
npm test
```

Очікується: 7 тестів PASS у цьому файлі.

- [ ] **Step 5: Коміт**

```bash
git add src/domain/optimistic.js src/domain/optimistic.test.js
git commit -m "feat: оптимістична зміна кількості з коректним відкатом"
```

---

### Task 6: Стиснення фото і форматування

**Files:**
- Create: `src/domain/image.js`
- Create: `src/lib/format.js`
- Create: `src/lib/format.test.js`

**Interfaces:**
- Consumes: нічого
- Produces:
  - `compressImage(file: File, maxSide = 1200, quality = 0.75): Promise<Blob>`
  - `formatQty(qty, unit): string`
  - `formatPrice(value): string`
  - `formatTotal(qty, price): string`

- [ ] **Step 1: Написати падаючі тести форматування**

`src/lib/format.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { formatQty, formatPrice, formatTotal } from './format.js'

describe('formatQty', () => {
  it('прибирає зайві нулі у цілих числах', () => {
    expect(formatQty(3, 'шт')).toBe('3 шт')
    expect(formatQty('3.00', 'шт')).toBe('3 шт')
  })

  it('лишає дробову частину, коли вона значуща', () => {
    expect(formatQty(1.5, 'кг')).toBe('1,5 кг')
  })
})

describe('formatPrice', () => {
  it('форматує з копійками і гривнею', () => {
    expect(formatPrice(42.5)).toBe('42,50 грн')
  })

  it('повертає риску, коли ціни немає', () => {
    expect(formatPrice(null)).toBe('—')
    expect(formatPrice(undefined)).toBe('—')
  })
})

describe('formatTotal', () => {
  it('множить кількість на ціну', () => {
    expect(formatTotal(3, 10)).toBe('30,00 грн')
  })

  it('повертає риску без ціни', () => {
    expect(formatTotal(3, null)).toBe('—')
  })
})
```

- [ ] **Step 2: Запустити тести — мають впасти**

```bash
npm test
```

Очікується: FAIL, модуль `./format.js` не знайдено.

- [ ] **Step 3: Реалізувати форматування**

`src/lib/format.js`:

```js
const nf = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 })
const cf = new Intl.NumberFormat('uk-UA', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatQty(qty, unit) {
  return `${nf.format(Number(qty))} ${unit}`.trim()
}

export function formatPrice(value) {
  if (value === null || value === undefined || value === '') return '—'
  return `${cf.format(Number(value))} грн`
}

export function formatTotal(qty, price) {
  if (price === null || price === undefined || price === '') return '—'
  return formatPrice(Number(qty) * Number(price))
}
```

- [ ] **Step 4: Запустити тести — мають пройти**

```bash
npm test
```

Очікується: 6 тестів PASS у цьому файлі.

- [ ] **Step 5: Реалізувати стиснення фото**

Тестами не покривається: потребує реального canvas, якого в jsdom немає. Перевіряється вручну на Task 12.

`src/domain/image.js`:

```js
// Знімок з телефону важить 3-4 МБ. Для картки в сітці достатньо 100-150 КБ,
// тому зменшуємо до 1200 px по довшій стороні і зберігаємо як JPEG.
export async function compressImage(file, maxSide = 1200, quality = 0.75) {
  const bitmap = await createImageBitmap(file)

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise(resolve =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  )
  if (!blob) throw new Error('не вдалося стиснути зображення')
  return blob
}
```

- [ ] **Step 6: Коміт**

```bash
git add src/lib/format.js src/lib/format.test.js src/domain/image.js
git commit -m "feat: форматування кількостей і цін, стиснення фото"
```

---

### Task 7: Клієнт Supabase і вхід

**Files:**
- Create: `src/lib/supabase.js`
- Create: `src/screens/LoginScreen.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `.env` зі `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Produces: `supabase` (клієнт), `App` рендерить `LoginScreen` без сесії і дочірній вміст із сесією; після входу викликається `ensure_default_categories`

- [ ] **Step 1: Створити клієнт**

`src/lib/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Не задано VITE_SUPABASE_URL або VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
```

- [ ] **Step 2: Створити екран входу**

`src/screens/LoginScreen.jsx`:

```jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('sending')
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    })

    if (error) {
      setError(error.message)
      setStatus('idle')
    } else {
      setStatus('sent')
    }
  }

  if (status === 'sent') {
    return (
      <main className="screen center">
        <h1>Перевір пошту</h1>
        <p className="muted">Надіслали посилання для входу на {email}.</p>
      </main>
    )
  }

  return (
    <main className="screen center">
      <h1>Запаси</h1>
      <form onSubmit={handleSubmit} className="stack">
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="твоя пошта"
          autoComplete="email"
        />
        <button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Надсилаю…' : 'Увійти'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Підключити перевірку сесії в App**

`src/App.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase.js'
import LoginScreen from './screens/LoginScreen.jsx'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) supabase.rpc('ensure_default_categories')
  }, [session?.user?.id])

  if (session === undefined) return <main className="screen center">Завантаження…</main>
  if (!session) return <LoginScreen />

  return <main className="screen"><h1>Увійшла</h1></main>
}
```

- [ ] **Step 4: Додати стилі форм**

Додати в кінець `src/styles.css`:

```css
.center {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
}

.stack { display: flex; flex-direction: column; gap: 12px; }

input, select, button, textarea {
  font: inherit;
  padding: 14px;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--text);
  width: 100%;
}

button {
  background: var(--accent);
  color: #fff;
  border: none;
  font-weight: 600;
  min-height: 48px;
}

button:disabled { opacity: .5; }
.muted { color: var(--muted); }
.error { color: var(--warn); }
```

- [ ] **Step 5: Перевірити вхід вручну**

```bash
npm run dev
```

Ввести свою пошту, перейти за посиланням з листа. Очікується: екран «Увійшла». У Supabase → Table Editor → categories з'явилось 4 рядки: прибирання, тіло, обличчя, ліки.

- [ ] **Step 6: Коміт**

```bash
git add src/lib/supabase.js src/screens/LoginScreen.jsx src/App.jsx src/styles.css
git commit -m "feat: вхід через magic link і категорії за замовчуванням"
```

---

### Task 8: Шар даних

**Files:**
- Create: `src/data/InventoryContext.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `supabase`, `applyDelta`, `compressImage`
- Produces: хук `useInventory()`, що повертає
  `{ items, categories, status, error, reload, adjust, createItem, updateItem, deleteItem, uploadPhoto, lastAction, undo, clearLastAction, online }`
  - `adjust(itemId, delta, kind, extra?) : Promise<void>` — `extra` це `{ price, place }`
  - `createItem(fields) : Promise<Item>`
  - `uploadPhoto(itemId, file) : Promise<string>` — повертає `photo_path`
  - `lastAction` — `{ itemId, applied } | null` для плашки скасування
  - `undo() : Promise<void>` — зворотна операція з `kind: 'correction'`

- [ ] **Step 1: Створити контекст**

`src/data/InventoryContext.jsx`:

```jsx
import { createContext, useContext, useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { applyDelta } from '../domain/optimistic.js'
import { compressImage } from '../domain/image.js'

const InventoryContext = createContext(null)

export function useInventory() {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('useInventory поза InventoryProvider')
  return ctx
}

export function InventoryProvider({ userId, children }) {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [lastAction, setLastAction] = useState(null)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  const reload = useCallback(async () => {
    setStatus('loading')
    setError(null)

    const [itemsRes, catsRes] = await Promise.all([
      supabase.from('items').select('*'),
      supabase.from('categories').select('*').order('sort_order'),
    ])

    if (itemsRes.error || catsRes.error) {
      setError(itemsRes.error?.message ?? catsRes.error.message)
      setStatus('error')
      return
    }

    setItems(itemsRes.data.map(normalize))
    setCategories(catsRes.data)
    setStatus('ready')
  }, [])

  useEffect(() => { reload() }, [reload, userId])

  // Автоматична повторна спроба, коли мережа повернулась.
  useEffect(() => {
    if (online && status === 'error') reload()
  }, [online, status, reload])

  const adjust = useCallback(async (itemId, delta, kind, extra = {}) => {
    const before = items
    const { items: optimistic, applied } = applyDelta(items, itemId, delta)
    setItems(optimistic)

    const { data, error } = await supabase.rpc('adjust_quantity', {
      p_item_id: itemId,
      p_delta: delta,
      p_kind: kind,
      p_price: extra.price ?? null,
      p_place: extra.place ?? null,
    })

    if (error) {
      // Відкат зворотною зміною, а не поверненням до знімка:
      // інакше паралельний тап, що встиг пройти, був би затертий.
      setItems(current => applyDelta(current, itemId, -applied).items)
      setError(error.message)
      throw error
    }

    // Сервер — джерело правди: підставляємо його рядок цілком.
    setItems(current => current.map(i => (i.id === itemId ? normalize(data) : i)))
    if (kind === 'consume') setLastAction({ itemId, applied })
    return data
  }, [items])

  const undo = useCallback(async () => {
    if (!lastAction) return
    const { itemId, applied } = lastAction
    setLastAction(null)
    await adjust(itemId, -applied, 'correction')
  }, [lastAction, adjust])

  const createItem = useCallback(async fields => {
    const { data, error } = await supabase
      .from('items')
      .insert({ ...fields, user_id: userId })
      .select()
      .single()
    if (error) throw error
    const item = normalize(data)
    setItems(current => [...current, item])
    return item
  }, [userId])

  const updateItem = useCallback(async (itemId, fields) => {
    const { data, error } = await supabase
      .from('items').update(fields).eq('id', itemId).select().single()
    if (error) throw error
    setItems(current => current.map(i => (i.id === itemId ? normalize(data) : i)))
    return data
  }, [])

  const deleteItem = useCallback(async itemId => {
    const { error } = await supabase.from('items').delete().eq('id', itemId)
    if (error) throw error
    setItems(current => current.filter(i => i.id !== itemId))
  }, [])

  const uploadPhoto = useCallback(async (itemId, file) => {
    const blob = await compressImage(file)
    const path = `${userId}/${itemId}.jpg`
    const { error } = await supabase.storage
      .from('photos')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (error) throw error
    await updateItem(itemId, { photo_path: path })
    return path
  }, [userId, updateItem])

  const value = {
    items, categories, status, error, online, lastAction,
    reload, adjust, undo, createItem, updateItem, deleteItem, uploadPhoto,
    clearLastAction: () => setLastAction(null),
  }

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

// Postgres numeric приїздить рядком, щоб не втратити точність.
// Для арифметики в інтерфейсі приводимо до числа в одному місці.
function normalize(row) {
  return {
    ...row,
    qty: Number(row.qty),
    threshold: Number(row.threshold),
    last_price: row.last_price === null ? null : Number(row.last_price),
  }
}
```

- [ ] **Step 2: Обгорнути застосунок провайдером**

`src/App.jsx` — замінити повернення при наявній сесії:

```jsx
import { InventoryProvider } from './data/InventoryContext.jsx'

// … решта без змін …

  return (
    <InventoryProvider userId={session.user.id}>
      <main className="screen"><h1>Увійшла</h1></main>
    </InventoryProvider>
  )
```

- [ ] **Step 3: Перевірити вручну**

```bash
npm run dev
```

Відкрити консоль браузера. Очікується: у вкладці Network видно успішні запити до `items` і `categories`, помилок немає.

- [ ] **Step 4: Коміт**

```bash
git add src/data/InventoryContext.jsx src/App.jsx
git commit -m "feat: шар даних з оптимістичними мутаціями та відстеженням мережі"
```

---

### Task 9: Storage для фото

**Files:**
- Create: `supabase/migrations/0005_storage.sql`

**Interfaces:**
- Consumes: нічого
- Produces: приватний бакет `photos` з політиками доступу за `user_id` у першому сегменті шляху

- [ ] **Step 1: Створити бакет**

Supabase → Storage → New bucket: назва `photos`, **Public bucket вимкнено**.

- [ ] **Step 2: Написати політики**

`supabase/migrations/0005_storage.sql`:

```sql
-- Шлях до файлу має вигляд {user_id}/{item_id}.jpg,
-- тож перший сегмент шляху і є ознакою власника.
create policy photos_read_own on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy photos_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy photos_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy photos_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
```

- [ ] **Step 3: Застосувати і перевірити**

Виконати в SQL Editor. Потім у Storage → photos спробувати відкрити пряме посилання на файл у приватному режимі браузера.
Очікується: доступ заборонено.

- [ ] **Step 4: Коміт**

```bash
git add supabase/migrations/0005_storage.sql
git commit -m "feat: приватний бакет для фото з політиками за власником"
```

---

### Task 10: Екран запасів

**Files:**
- Create: `src/ui/States.jsx`
- Create: `src/ui/ItemCard.jsx`
- Create: `src/ui/CategoryStrip.jsx`
- Create: `src/ui/BottomNav.jsx`
- Create: `src/screens/StockScreen.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `useInventory`, `sortByUrgency`, `isLow`, `formatQty`
- Produces: маршрут `/` зі списком карток; кнопка «−1» викликає `adjust(id, -1, 'consume')`

- [ ] **Step 1: Створити стани списків**

`src/ui/States.jsx`:

```jsx
export function Skeleton({ count = 4 }) {
  return (
    <div className="grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card skeleton" aria-hidden="true" />
      ))}
    </div>
  )
}

export function Empty({ title, action }) {
  return (
    <div className="empty">
      <p>{title}</p>
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="empty">
      <p className="error">{message}</p>
      <button onClick={onRetry}>Спробувати ще</button>
    </div>
  )
}
```

- [ ] **Step 2: Створити картку товару**

`src/ui/ItemCard.jsx`:

```jsx
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { formatQty } from '../lib/format.js'
import { isLow } from '../domain/sorting.js'

export default function ItemCard({ item, onConsume }) {
  const url = item.photo_path
    ? supabase.storage.from('photos').getPublicUrl(item.photo_path).data.publicUrl
    : null

  return (
    <article className={`card${isLow(item) ? ' card--low' : ''}`}>
      <Link to={`/item/${item.id}`} className="card__link">
        {url
          ? <img src={url} alt="" className="card__photo" loading="lazy" />
          : <div className="card__photo card__photo--empty" aria-hidden="true" />}
        <h2 className="card__name">{item.name}</h2>
        <p className="card__qty">{formatQty(item.qty, item.unit)}</p>
      </Link>
      <button
        className="card__consume"
        onClick={() => onConsume(item.id)}
        disabled={item.qty <= 0}
        aria-label={`Витратити одну одиницю: ${item.name}`}
      >
        −1
      </button>
    </article>
  )
}
```

- [ ] **Step 3: Створити стрічку категорій і нижню навігацію**

`src/ui/CategoryStrip.jsx`:

```jsx
export default function CategoryStrip({ categories, selected, onSelect }) {
  return (
    <nav className="strip" aria-label="Категорії">
      <button
        className={`chip${selected === null ? ' chip--on' : ''}`}
        onClick={() => onSelect(null)}
      >
        усі
      </button>
      {categories.map(c => (
        <button
          key={c.id}
          className={`chip${selected === c.id ? ' chip--on' : ''}`}
          onClick={() => onSelect(c.id)}
        >
          {c.name}
        </button>
      ))}
    </nav>
  )
}
```

`src/ui/BottomNav.jsx`:

```jsx
import { NavLink } from 'react-router-dom'

export default function BottomNav() {
  return (
    <nav className="bottomnav">
      <NavLink to="/" end className={({ isActive }) => isActive ? 'on' : ''}>Запаси</NavLink>
      <NavLink to="/shopping" className={({ isActive }) => isActive ? 'on' : ''}>Покупки</NavLink>
    </nav>
  )
}
```

- [ ] **Step 4: Створити екран запасів**

`src/screens/StockScreen.jsx`:

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { sortByUrgency } from '../domain/sorting.js'
import ItemCard from '../ui/ItemCard.jsx'
import CategoryStrip from '../ui/CategoryStrip.jsx'
import { Skeleton, Empty, ErrorState } from '../ui/States.jsx'

export default function StockScreen() {
  const { items, categories, status, error, reload, adjust } = useInventory()
  const [category, setCategory] = useState(null)

  if (status === 'loading') return <Skeleton />
  if (status === 'error') return <ErrorState message={error} onRetry={reload} />

  if (items.length === 0) {
    return (
      <Empty
        title="Поки що порожньо"
        action={<Link to="/add"><button>Додати перший товар</button></Link>}
      />
    )
  }

  const visible = sortByUrgency(
    category ? items.filter(i => i.category_id === category) : items
  )

  return (
    <>
      <CategoryStrip categories={categories} selected={category} onSelect={setCategory} />
      <div className="grid">
        {visible.map(item => (
          <ItemCard
            key={item.id}
            item={item}
            onConsume={id => adjust(id, -1, 'consume').catch(() => {})}
          />
        ))}
      </div>
      <Link to="/add" className="fab" aria-label="Додати товар">+</Link>
    </>
  )
}
```

- [ ] **Step 5: Підключити маршрути**

`src/App.jsx` — замінити блок із провайдером:

```jsx
import { Routes, Route } from 'react-router-dom'
import { InventoryProvider } from './data/InventoryContext.jsx'
import StockScreen from './screens/StockScreen.jsx'
import BottomNav from './ui/BottomNav.jsx'

// … решта без змін …

  return (
    <InventoryProvider userId={session.user.id}>
      <main className="screen">
        <Routes>
          <Route path="/" element={<StockScreen />} />
        </Routes>
      </main>
      <BottomNav />
    </InventoryProvider>
  )
```

- [ ] **Step 6: Додати стилі сітки**

Додати в кінець `src/styles.css`:

```css
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.card--low { border-color: var(--warn); }

.card__link { text-decoration: none; color: inherit; padding: 10px; flex: 1; display: block; }
.card__photo { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 10px; display: block; }
.card__photo--empty { background: var(--line); }
.card__name { font-size: 15px; font-weight: 600; margin: 8px 0 2px; }
.card__qty { margin: 0; font-size: 20px; font-weight: 700; }

/* Ціль завбільшки з половину картки — щоб влучати не дивлячись. */
.card__consume {
  border-radius: 0;
  min-height: 56px;
  font-size: 22px;
  background: var(--text);
}

.strip { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 12px; }
.chip {
  width: auto;
  flex: 0 0 auto;
  padding: 8px 14px;
  min-height: 0;
  background: var(--surface);
  color: var(--muted);
  border: 1px solid var(--line);
  border-radius: 999px;
  font-weight: 500;
}
.chip--on { background: var(--text); color: #fff; border-color: var(--text); }

.empty { text-align: center; padding: 48px 16px; color: var(--muted); }

.fab {
  position: fixed;
  right: 16px;
  bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 16px);
  width: 56px; height: 56px;
  border-radius: 50%;
  background: var(--accent); color: #fff;
  display: grid; place-items: center;
  font-size: 28px; text-decoration: none;
  box-shadow: 0 4px 16px rgba(0,0,0,.18);
}

.bottomnav {
  position: fixed; left: 0; right: 0; bottom: 0;
  height: calc(var(--nav-h) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  display: grid; grid-template-columns: 1fr 1fr;
  background: var(--surface); border-top: 1px solid var(--line);
}
.bottomnav a {
  display: grid; place-items: center;
  text-decoration: none; color: var(--muted); font-weight: 600;
}
.bottomnav a.on { color: var(--text); }

.skeleton { height: 200px; background: var(--line); animation: pulse 1.2s infinite; }
@keyframes pulse { 50% { opacity: .5; } }
```

- [ ] **Step 7: Перевірити вручну**

Додати тестовий рядок у таблицю `items` через Supabase Table Editor (name, qty, unit, user_id). Запустити `npm run dev`.
Очікується: картка видима, тап «−1» одразу зменшує число, у таблиці `events` з'явився рядок `consume`.

- [ ] **Step 8: Коміт**

```bash
git add src/ui src/screens/StockScreen.jsx src/App.jsx src/styles.css
git commit -m "feat: екран запасів із сіткою карток і кнопкою витрати"
```

---

### Task 11: Скасування і стан мережі

**Files:**
- Create: `src/ui/UndoToast.jsx`
- Create: `src/ui/NetworkBanner.jsx`
- Modify: `src/App.jsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `useInventory().lastAction`, `undo`, `clearLastAction`, `online`
- Produces: плашка скасування зі зникненням через 5 секунд; плашка відсутності зв'язку

- [ ] **Step 1: Створити плашку скасування**

`src/ui/UndoToast.jsx`:

```jsx
import { useEffect } from 'react'
import { useInventory } from '../data/InventoryContext.jsx'

export default function UndoToast() {
  const { lastAction, undo, clearLastAction, items } = useInventory()

  useEffect(() => {
    if (!lastAction) return
    const timer = setTimeout(clearLastAction, 5000)
    return () => clearTimeout(timer)
  }, [lastAction, clearLastAction])

  if (!lastAction) return null

  const item = items.find(i => i.id === lastAction.itemId)

  return (
    <div className="toast" role="status">
      <span>Витрачено {Math.abs(lastAction.applied)} · {item?.name ?? ''}</span>
      <button onClick={() => undo().catch(() => {})}>Скасувати</button>
    </div>
  )
}
```

- [ ] **Step 2: Створити плашку мережі**

`src/ui/NetworkBanner.jsx`:

```jsx
import { useInventory } from '../data/InventoryContext.jsx'

export default function NetworkBanner() {
  const { online } = useInventory()
  if (online) return null
  return <div className="banner" role="alert">Немає зв'язку. Спробую ще, коли з'явиться.</div>
}
```

- [ ] **Step 3: Підключити в App**

`src/App.jsx` — додати всередину `InventoryProvider`, після `</main>`:

```jsx
      <NetworkBanner />
      <UndoToast />
      <BottomNav />
```

Не забути імпорти:

```jsx
import UndoToast from './ui/UndoToast.jsx'
import NetworkBanner from './ui/NetworkBanner.jsx'
```

- [ ] **Step 4: Додати стилі**

Додати в кінець `src/styles.css`:

```css
.toast {
  position: fixed;
  left: 16px; right: 16px;
  bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 16px);
  background: var(--text); color: #fff;
  border-radius: var(--radius);
  padding: 12px 12px 12px 16px;
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  box-shadow: 0 6px 20px rgba(0,0,0,.2);
}
.toast button {
  width: auto; min-height: 0; padding: 8px 14px;
  background: transparent; color: #fff;
  border: 1px solid rgba(255,255,255,.4); border-radius: 10px;
}

.banner {
  position: fixed; top: 0; left: 0; right: 0;
  background: var(--warn); color: #fff;
  padding: 10px 16px; text-align: center; font-size: 14px;
}
```

- [ ] **Step 5: Перевірити вручну**

Тапнути «−1» — з'являється плашка, зникає через 5 секунд. Натиснути «Скасувати» — кількість повертається, у `events` з'явився рядок `correction` з протилежним знаком. У DevTools → Network увімкнути Offline — з'являється верхня плашка.

- [ ] **Step 6: Коміт**

```bash
git add src/ui/UndoToast.jsx src/ui/NetworkBanner.jsx src/App.jsx src/styles.css
git commit -m "feat: скасування витрати і індикація відсутності зв'язку"
```

---

### Task 12: Додавання товару

**Files:**
- Create: `src/screens/AddItemScreen.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useInventory().createItem`, `uploadPhoto`, `categories`
- Produces: маршрут `/add`

- [ ] **Step 1: Створити екран**

`src/screens/AddItemScreen.jsx`:

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'

const UNITS = ['шт', 'кг', 'г', 'л', 'мл', 'пачка', 'рулон']

export default function AddItemScreen() {
  const { categories, createItem, uploadPhoto } = useInventory()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '', qty: '1', unit: 'шт', threshold: '1',
    category_id: '', last_price: '', last_place: '',
  })
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)

    try {
      const item = await createItem({
        name: form.name.trim(),
        qty: Number(form.qty),
        unit: form.unit,
        threshold: Number(form.threshold),
        category_id: form.category_id || null,
        last_price: form.last_price === '' ? null : Number(form.last_price),
        last_place: form.last_place.trim() || null,
      })

      // Фото вантажиться окремо: невдача тут не має скасовувати
      // вже створений товар і втрачати заповнену форму.
      if (file) {
        try {
          await uploadPhoto(item.id, file)
        } catch {
          setError('Товар збережено, але фото не завантажилось. Додай його в картці.')
        }
      }

      navigate('/')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="stack">
      <h1>Новий товар</h1>

      <label className="field">
        Фото
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={e => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <label className="field">
        Назва
        <input required value={form.name} onChange={e => set('name', e.target.value)} />
      </label>

      <div className="row">
        <label className="field">
          Кількість
          <input type="number" inputMode="decimal" step="any" min="0"
                 required value={form.qty} onChange={e => set('qty', e.target.value)} />
        </label>
        <label className="field">
          Одиниця
          <select value={form.unit} onChange={e => set('unit', e.target.value)}>
            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
      </div>

      <label className="field">
        Поріг «закінчується»
        <input type="number" inputMode="decimal" step="any" min="0"
               value={form.threshold} onChange={e => set('threshold', e.target.value)} />
      </label>

      <label className="field">
        Категорія
        <select value={form.category_id} onChange={e => set('category_id', e.target.value)}>
          <option value="">без категорії</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>

      <div className="row">
        <label className="field">
          Ціна за одиницю
          <input type="number" inputMode="decimal" step="0.01" min="0"
                 value={form.last_price} onChange={e => set('last_price', e.target.value)} />
        </label>
        <label className="field">
          Де куплено
          <input value={form.last_place} onChange={e => set('last_place', e.target.value)} />
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={busy}>{busy ? 'Зберігаю…' : 'Зберегти'}</button>
      <button type="button" className="ghost" onClick={() => navigate('/')}>Скасувати</button>
    </form>
  )
}
```

- [ ] **Step 2: Додати маршрут**

У `src/App.jsx` у `<Routes>`:

```jsx
        <Route path="/add" element={<AddItemScreen />} />
```

З імпортом `import AddItemScreen from './screens/AddItemScreen.jsx'`.

- [ ] **Step 3: Додати стилі полів**

Додати в кінець `src/styles.css`:

```css
.field { display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: var(--muted); }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.ghost { background: transparent; color: var(--muted); border: 1px solid var(--line); }
```

- [ ] **Step 4: Перевірити вручну, включно зі стисненням фото**

Додати товар з фото з камери телефону. У Supabase → Storage → photos перевірити розмір файлу.
Очікується: файл важить приблизно 100–200 КБ, а не кілька мегабайт.

- [ ] **Step 5: Коміт**

```bash
git add src/screens/AddItemScreen.jsx src/App.jsx src/styles.css
git commit -m "feat: додавання товару з фото і стисненням на клієнті"
```

---

### Task 13: Картка товару

**Files:**
- Create: `src/screens/ItemScreen.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useInventory()`, `formatPrice`, `formatTotal`, `formatQty`
- Produces: маршрут `/item/:id`; форма поповнення викликає `adjust(id, +N, 'restock', { price, place })`

- [ ] **Step 1: Створити екран**

`src/screens/ItemScreen.jsx`:

```jsx
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useInventory } from '../data/InventoryContext.jsx'
import { formatQty, formatPrice, formatTotal } from '../lib/format.js'

const KIND_LABEL = { consume: 'витрата', restock: 'поповнення', correction: 'виправлення' }

export default function ItemScreen() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, adjust, deleteItem, uploadPhoto } = useInventory()
  const item = items.find(i => i.id === id)

  const [events, setEvents] = useState([])
  const [restock, setRestock] = useState({ qty: '1', price: '', place: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('events').select('*').eq('item_id', id)
      .order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => { if (!cancelled) setEvents(data ?? []) })
    return () => { cancelled = true }
  }, [id, item?.qty])

  if (!item) return <p className="muted">Товар не знайдено.</p>

  const photoUrl = item.photo_path
    ? supabase.storage.from('photos').getPublicUrl(item.photo_path).data.publicUrl
    : null

  async function handleRestock(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await adjust(item.id, Number(restock.qty), 'restock', {
        price: restock.price === '' ? null : Number(restock.price),
        place: restock.place.trim() || null,
      })
      setRestock({ qty: '1', price: '', place: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Видалити «${item.name}»? Журнал операцій теж зникне.`)) return
    await deleteItem(item.id)
    navigate('/')
  }

  return (
    <div className="stack">
      <button className="ghost" onClick={() => navigate(-1)}>← Назад</button>

      {photoUrl
        ? <img src={photoUrl} alt="" className="hero" />
        : <label className="hero hero--empty">
            Додати фото
            <input type="file" accept="image/*" capture="environment" hidden
                   onChange={e => {
                     const f = e.target.files?.[0]
                     if (f) uploadPhoto(item.id, f).catch(err => setError(err.message))
                   }} />
          </label>}

      <h1>{item.name}</h1>
      <p className="card__qty">{formatQty(item.qty, item.unit)}</p>

      <dl className="facts">
        <dt>Ціна за одиницю</dt><dd>{formatPrice(item.last_price)}</dd>
        <dt>Вартість залишку</dt><dd>{formatTotal(item.qty, item.last_price)}</dd>
        <dt>Де куплено</dt><dd>{item.last_place ?? '—'}</dd>
        <dt>Поріг</dt><dd>{formatQty(item.threshold, item.unit)}</dd>
      </dl>

      <form onSubmit={handleRestock} className="stack">
        <h2>Поповнити</h2>
        <div className="row">
          <label className="field">
            Скільки додати
            <input type="number" inputMode="decimal" step="any" min="0.01" required
                   value={restock.qty}
                   onChange={e => setRestock(r => ({ ...r, qty: e.target.value }))} />
          </label>
          <label className="field">
            Нова ціна
            <input type="number" inputMode="decimal" step="0.01" min="0"
                   value={restock.price}
                   onChange={e => setRestock(r => ({ ...r, price: e.target.value }))} />
          </label>
        </div>
        <label className="field">
          Де куплено
          <input value={restock.place}
                 onChange={e => setRestock(r => ({ ...r, place: e.target.value }))} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Зберігаю…' : 'Поповнити'}</button>
      </form>

      <h2>Історія</h2>
      {events.length === 0
        ? <p className="muted">Операцій ще не було.</p>
        : <ul className="history">
            {events.map(e => (
              <li key={e.id}>
                <span>{Number(e.delta) > 0 ? `+${e.delta}` : e.delta}</span>
                <span className="muted">{KIND_LABEL[e.kind]}</span>
                <span className="muted">
                  {new Date(e.created_at).toLocaleDateString('uk-UA', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ul>}

      <button className="ghost" onClick={handleDelete}>Видалити товар</button>
    </div>
  )
}
```

- [ ] **Step 2: Додати маршрут**

У `src/App.jsx`:

```jsx
        <Route path="/item/:id" element={<ItemScreen />} />
```

З імпортом `import ItemScreen from './screens/ItemScreen.jsx'`.

- [ ] **Step 3: Додати стилі**

Додати в кінець `src/styles.css`:

```css
.hero { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: var(--radius); }
.hero--empty {
  display: grid; place-items: center;
  background: var(--line); color: var(--muted); cursor: pointer;
}
.facts { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; margin: 0; }
.facts dt { color: var(--muted); font-size: 14px; }
.facts dd { margin: 0; text-align: right; font-weight: 600; }
.history { list-style: none; padding: 0; margin: 0; }
.history li {
  display: grid; grid-template-columns: 60px 1fr auto;
  gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--line);
}
```

- [ ] **Step 4: Перевірити вручну**

Відкрити картку, поповнити на 5 з ціною 42.50 і місцем «АТБ».
Очікується: кількість зросла, ціна й місце оновились, в історії з'явився рядок «+5 поповнення».

- [ ] **Step 5: Коміт**

```bash
git add src/screens/ItemScreen.jsx src/App.jsx src/styles.css
git commit -m "feat: картка товару з поповненням і журналом операцій"
```

---

### Task 14: Список покупок

**Files:**
- Create: `src/screens/ShoppingScreen.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- Consumes: `useInventory()`, `isLow`, `sortByUrgency`
- Produces: маршрут `/shopping`

- [ ] **Step 1: Створити екран**

`src/screens/ShoppingScreen.jsx`:

```jsx
import { Link } from 'react-router-dom'
import { useInventory } from '../data/InventoryContext.jsx'
import { isLow, sortByUrgency } from '../domain/sorting.js'
import { formatQty, formatPrice } from '../lib/format.js'
import { Skeleton, Empty, ErrorState } from '../ui/States.jsx'

export default function ShoppingScreen() {
  const { items, status, error, reload } = useInventory()

  if (status === 'loading') return <Skeleton count={3} />
  if (status === 'error') return <ErrorState message={error} onRetry={reload} />

  const low = sortByUrgency(items.filter(isLow))

  if (low.length === 0) {
    return <Empty title="Усе на місці — купувати нічого" />
  }

  return (
    <>
      <h1>Купити</h1>
      <ul className="shopping">
        {low.map(item => (
          <li key={item.id}>
            <div>
              <p className="shopping__name">{item.name}</p>
              <p className="muted">
                лишилось {formatQty(item.qty, item.unit)} · {formatPrice(item.last_price)}
                {item.last_place ? ` · ${item.last_place}` : ''}
              </p>
            </div>
            <Link to={`/item/${item.id}`}>
              <button className="ghost">Купила</button>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
```

- [ ] **Step 2: Додати маршрут**

У `src/App.jsx`:

```jsx
        <Route path="/shopping" element={<ShoppingScreen />} />
```

З імпортом `import ShoppingScreen from './screens/ShoppingScreen.jsx'`.

- [ ] **Step 3: Додати стилі**

Додати в кінець `src/styles.css`:

```css
.shopping { list-style: none; padding: 0; margin: 0; }
.shopping li {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 14px 0; border-bottom: 1px solid var(--line);
}
.shopping__name { margin: 0 0 2px; font-weight: 600; }
.shopping .muted { margin: 0; font-size: 14px; }
.shopping button { width: auto; padding: 10px 16px; min-height: 0; }
```

- [ ] **Step 4: Перевірити вручну**

Довести товар кнопкою «−1» до значення порога.
Очікується: товар з'явився у вкладці «Покупки»; «Купила» веде на картку з формою поповнення.

- [ ] **Step 5: Коміт**

```bash
git add src/screens/ShoppingScreen.jsx src/App.jsx src/styles.css
git commit -m "feat: список покупок як вибірка товарів нижче порога"
```

---

### Task 15: PWA

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/icon-192.png`, `public/icon-512.png`
- Create: `scripts/make-icons.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: нічого
- Produces: застосунок встановлюється на головний екран у повноекранному режимі

- [ ] **Step 1: Згенерувати іконки**

`scripts/make-icons.mjs`:

```js
// Проста іконка без зовнішніх залежностей: SVG -> PNG через sharp.
// Якщо sharp недоступний, зберегти SVG і сконвертувати вручну.
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <rect width="512" height="512" rx="112" fill="#2f6d5b"/>
  <rect x="136" y="150" width="240" height="228" rx="24" fill="#faf9f7"/>
  <rect x="136" y="150" width="240" height="56" rx="24" fill="#1c1b1a"/>
  <rect x="176" y="250" width="160" height="20" rx="10" fill="#2f6d5b"/>
  <rect x="176" y="300" width="104" height="20" rx="10" fill="#c9c3bc"/>
</svg>`

writeFileSync('public/icon.svg', svg)
for (const size of [192, 512]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/icon-${size}.png`)
}
console.log('іконки готові')
```

```bash
npm install -D sharp
node scripts/make-icons.mjs
```

- [ ] **Step 2: Створити маніфест**

`public/manifest.webmanifest`:

```json
{
  "name": "Запаси",
  "short_name": "Запаси",
  "start_url": "/home_inventory/",
  "scope": "/home_inventory/",
  "display": "standalone",
  "background_color": "#faf9f7",
  "theme_color": "#1c1b1a",
  "lang": "uk",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3: Підключити маніфест**

У `index.html` у `<head>`:

```html
    <link rel="manifest" href="/home_inventory/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/home_inventory/icon-192.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

- [ ] **Step 4: Перевірити**

```bash
npm run build && npm run preview
```

У DevTools → Application → Manifest: помилок немає, іконки видно.

- [ ] **Step 5: Коміт**

```bash
git add public index.html scripts/make-icons.mjs package.json
git commit -m "feat: PWA-маніфест та іконки"
```

---

### Task 16: Деплой на GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `README.md`

**Interfaces:**
- Consumes: секрети репозиторію `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Produces: автоматичний деплой на `https://evgenia-shetil.github.io/home_inventory/`

- [ ] **Step 1: Створити workflow**

`.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Написати README**

`README.md`:

```markdown
# Запаси

PWA для обліку домашніх запасів. React + Supabase, хоститься на GitHub Pages.

## Локальний запуск

    npm install
    cp .env.example .env    # вписати anon key
    npm run dev

## Тести

    npm test                                    # чиста логіка
    node --env-file=.env node_modules/vitest/vitest.mjs run tests/integration

## Міграції

SQL із `supabase/migrations/` виконується вручну в Supabase SQL Editor по порядку номерів.

## Перевірка доступу

    node --env-file=.env scripts/verify-rls.mjs

Має вивести три рядки `ok`. Якщо хоч одна таблиця віддає дані анонімному клієнту — RLS зламано.

## Документація

- Дизайн: `docs/superpowers/specs/2026-09-23-home-inventory-design.md`
- План: `docs/superpowers/plans/2026-09-23-home-inventory.md`
```

- [ ] **Step 3: Додати секрети і ввімкнути Pages**

GitHub → Settings → Secrets and variables → Actions → додати `VITE_SUPABASE_URL` і `VITE_SUPABASE_ANON_KEY`.
GitHub → Settings → Pages → Source: GitHub Actions.

- [ ] **Step 4: Запушити**

```bash
git remote add origin https://github.com/evgenia-shetil/home_inventory.git
git branch -M main
git add .github README.md
git commit -m "ci: деплой на GitHub Pages"
git push -u origin main
```

- [ ] **Step 5: Перевірити деплой**

Дочекатись завершення Actions. Відкрити `https://evgenia-shetil.github.io/home_inventory/` з телефону.

Очікується: вхід працює, товари видно, «−1» працює. Через Safari → Поділитися → На головний екран застосунок ставиться і відкривається без адресного рядка.

**Важливо:** у Supabase → Authentication → URL Configuration додати `https://evgenia-shetil.github.io/home_inventory/` у Redirect URLs, інакше посилання з листа не спрацює.

- [ ] **Step 6: Фінальна перевірка доступу**

```bash
node --env-file=.env scripts/verify-rls.mjs
```

Очікується: три рядки `ok`.

---

## Self-Review

**Покриття специфікації:**

| Розділ специфікації | Задача |
|---|---|
| 2. Обсяг v1 | 10–14 |
| 3. Архітектура, стек | 1 |
| 4. Модель даних | 2 |
| 5. adjust_quantity | 3 |
| 6. Безпека (RLS, magic link, Storage, ключі) | 2, 7, 9, 16 |
| 7. Екрани | 7, 10, 12, 13, 14 |
| 8. Оптимістичне оновлення, стани, мережа, фото | 5, 6, 10, 11, 12 |
| 9. PWA | 15 |
| 10. Деплой | 16 |
| 11. Тестування | 3, 4, 5, 6 |

Розрив: «прогноз скоро закінчиться» — свідомо поза обсягом v1, зафіксовано у специфікації.

**Узгодженість імен:** `adjust_quantity` (SQL) ↔ `adjust` (контекст) ↔ `p_item_id/p_delta/p_kind/p_price/p_place` — однаково в Task 3, 8, 13. `applyDelta` повертає `{ items, applied }` у Task 5 і саме так споживається в Task 8. `isLow`/`sortByUrgency` з Task 4 використовуються в Task 10 і 14. `photo_path` — однаково в Task 2, 8, 9, 10, 13.

**Заглушки:** відсутні. Кожен крок містить повний код або точну команду з очікуваним результатом.
