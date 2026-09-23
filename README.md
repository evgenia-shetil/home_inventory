# Запаси

PWA для обліку домашніх запасів. React + Supabase, хоститься на GitHub Pages.

## Локальний запуск

```
npm install
cp .env.example .env    # вписати anon key
npm run dev
```

## Тести

```
npm test
```

Інтеграційні тести проти реальної бази вимагають `TEST_EMAIL` і `TEST_PASSWORD`
у `.env` — без них вони пропускаються:

```
node --env-file=.env node_modules/vitest/vitest.mjs run tests/integration
```

## Міграції

SQL із `supabase/migrations/` виконується вручну в Supabase SQL Editor
по порядку номерів. Бакет `photos` створюється в панелі Storage **приватним**,
перед застосуванням `0005_storage.sql`.

## Перевірка доступу

```
node --env-file=.env scripts/verify-rls.mjs
```

Має вивести три рядки `ok`. Якщо хоч одна таблиця віддає дані анонімному
клієнту — RLS зламано, деплоїти не можна.

## Іконки

```
node scripts/make-icons.mjs
```

## Документація

- Дизайн: `docs/superpowers/specs/2026-09-23-home-inventory-design.md`
- План: `docs/superpowers/plans/2026-09-23-home-inventory.md`
