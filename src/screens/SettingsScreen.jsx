import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useInventory } from '../data/InventoryContext.jsx'
import { planAutoSort } from '../domain/autosort.js'
import { plural } from '../lib/plural.js'
import Dialog from '../ui/Dialog.jsx'
import { validatePassword, authErrorMessage } from '../domain/credentials.js'

export default function SettingsScreen({ email }) {
  const { items, categories, updateItem } = useInventory()
  const [sorting, setSorting] = useState(false)
  const [sortResult, setSortResult] = useState(null)
  const [confirmSort, setConfirmSort] = useState(false)
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  async function changePassword(e) {
    e.preventDefault()
    const invalid = validatePassword(password)
    if (invalid) {
      setError(invalid)
      setMessage(null)
      return
    }

    setStatus('busy')
    setError(null)
    setMessage(null)

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(authErrorMessage(error))
    } else {
      setMessage('Пароль збережено')
      setPassword('')
    }
    setStatus('idle')
  }

  // Словник підказок доповнюється, тож товари, заведені раніше,
  // лишаються нерозкладеними. Тут їх можна розкласти заднім числом.
  const plan = planAutoSort(items, categories)

  async function autoSort() {
    setConfirmSort(false)
    setSorting(true)
    setSortResult(null)
    let done = 0
    try {
      for (const change of plan) {
        await updateItem(change.id, { category_id: change.categoryId })
        done += 1
      }
      setSortResult(`Розкладено ${done} ${plural(done, 'товар', 'товари', 'товарів')}`)
    } catch (err) {
      setSortResult(`Розкладено ${done}, далі помилка: ${err.message}`)
    } finally {
      setSorting(false)
    }
  }

  return (
    <div className="stack">
      <h1>Ще</h1>
      <p className="muted">Ти увійшла як {email}</p>

      <h2>Витрати</h2>
      <Link to="/spending"><button type="button" className="ghost">Скільки витрачено</button></Link>

      <h2>Категорії</h2>
      <Link to="/categories"><button type="button" className="ghost">Керувати категоріями</button></Link>

      {plan.length > 0 && (
        <>
          <p className="muted">
            {plan.length} {plural(plan.length, 'товар', 'товари', 'товарів')} без підкатегорії
            можна розкласти автоматично: {plan.slice(0, 3).map(p => p.name).join(', ')}
            {plan.length > 3 ? ' та інші' : ''}.
          </p>
          <button type="button" onClick={() => setConfirmSort(true)} disabled={sorting}>
            {sorting ? 'Розкладаю…' : 'Розкласти по підкатегоріях'}
          </button>
        </>
      )}
      {sortResult && <p className="muted">{sortResult}</p>}

      {confirmSort && (
        <Dialog
          title={`Розкласти ${plan.length} ${plural(plan.length, 'товар', 'товари', 'товарів')}?`}
          description={`Застосунок сам обере підкатегорію за назвою. Те, що ти вже розклала руками, не зміниться. Скасувати одним рухом не вийде — категорію доведеться виправляти в картках окремо. Наприклад: ${plan.slice(0, 3).map(p => p.name).join(', ')}.`}
          confirmLabel="Розкласти"
          onConfirm={autoSort}
          onCancel={() => setConfirmSort(false)}
        />
      )}

      <form onSubmit={changePassword} className="stack">
        <h2>Пароль</h2>
        <label className="field">
          Новий пароль
          <input
            type="password" value={password} autoComplete="new-password"
            onChange={e => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        {message && <p className="muted">{message}</p>}
        <button type="submit" disabled={status === 'busy'}>
          {status === 'busy' ? 'Зберігаю…' : 'Зберегти пароль'}
        </button>
      </form>

      <h2>Сесія</h2>
      <button className="ghost" onClick={() => supabase.auth.signOut()}>
        Вийти з акаунта
      </button>
    </div>
  )
}
