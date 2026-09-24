// Готує SQL для відновлення обліку з файлу резервної копії.
//
//   node scripts/restore-sql.mjs zapasy-2026-09-24.json пошта@акаунта > restore.sql
//
// Потім вміст restore.sql — у Supabase → SQL Editor → New query → Run.
import { readFileSync } from 'node:fs'
import { buildRestoreSql } from './lib/restore.mjs'

const [file, email] = process.argv.slice(2)
if (!file || !email) {
  console.error('Використання: node scripts/restore-sql.mjs <файл копії> <пошта акаунта>')
  process.exit(1)
}

try {
  process.stdout.write(buildRestoreSql(JSON.parse(readFileSync(file, 'utf8')), email))
} catch (err) {
  console.error(err.message)
  process.exit(1)
}
