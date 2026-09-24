import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useInventory } from '../data/InventoryContext.jsx'
import { planAutoSort } from '../domain/autosort.js'
import { plural } from '../lib/plural.js'
import Dialog from '../ui/Dialog.jsx'
import { IconChevron } from '../ui/icons.jsx'
import { validatePassword, authErrorMessage } from '../domain/credentials.js'
import { daysSince } from '../domain/backup.js'
import { exportBackup, lastBackupAt } from '../lib/backup.js'
import { forgetUser, lastUserId } from '../lib/offlineStore.js'

export default function SettingsScreen({ email }) {
  const { items, categories, updateItem, notify, pending } = useInventory()
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [lastBackup, setLastBackup] = useState(lastBackupAt)
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

  // Знімок і черга стерті разом із сесією: на спільному пристрої
  // чужий облік не повинен лишатись у браузері.
  async function signOut() {
    const userId = lastUserId()
    const { error } = await supabase.auth.signOut()
    if (error) return notify(error.message, { tone: 'error' })
    if (userId) forgetUser(userId)
  }

  async function backup() {
    setExporting(true)
    try {
      const { how, counts } = await exportBackup()
      if (how === 'cancelled') {
        notify('Копію не збережено')
      } else {
        setLastBackup(lastBackupAt())
        notify(`Копію створено: ${counts.items} ${plural(counts.items, 'товар', 'товари', 'товарів')}, ${counts.events} ${plural(counts.events, 'запис', 'записи', 'записів')} журналу`,
          { tone: 'success' })
      }
    } catch (err) {
      notify(`Копію не створено: ${err.message}`, { tone: 'error' })
    } finally {
      setExporting(false)
    }
  }

  const age = daysSince(lastBackup)

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
      setSortResult(`Розподілено ${done} ${plural(done, 'товар', 'товари', 'товарів')}`)
    } catch (err) {
      setSortResult(`Розподілено ${done}, далі помилка: ${err.message}`)
    } finally {
      setSorting(false)
    }
  }

  return (
    <div className="stack">
      <h1>Ще</h1>
      <p className="muted">Обліковий запис: {email ?? 'недоступний без мережі'}</p>

      <h2>Резервна копія</h2>
      <p className="muted">
        Товари, категорії й журнал операцій одним файлом. Фото не входять.
        {' '}{age === null
          ? 'На цьому пристрої копій ще не було.'
          : age === 0 ? 'Остання копія — сьогодні.'
          : `Остання копія — ${age} ${plural(age, 'день', 'дні', 'днів')} тому.`}
      </p>
      <button type="button" onClick={backup} disabled={exporting}>
        {exporting ? 'Збирання…' : 'Зберегти копію'}
      </button>

      {/* Розділи — рядки-посилання, як відомість на головних екранах.
          Раніше кожен був заголовком і кнопкою з тим самим текстом. */}
      <h2>Розділи</h2>
      <ul className="navlist">
        <li><Link to="/categories">Категорії<IconChevron /></Link></li>
        <li><Link to="/spending">Витрати<IconChevron /></Link></li>
        <li><Link to="/expiring">Термін придатності<IconChevron /></Link></li>
      </ul>

      {plan.length > 0 && (
        <>
          <p className="muted">
            {plan.length} {plural(plan.length, 'товар', 'товари', 'товарів')} без підкатегорії
            можна розподілити автоматично: {plan.slice(0, 3).map(p => p.name).join(', ')}
            {plan.length > 3 ? ' та інші' : ''}.
          </p>
          <button type="button" className="ghost" onClick={() => setConfirmSort(true)} disabled={sorting}>
            {sorting ? 'Розподіл…' : 'Розподілити по підкатегоріях'}
          </button>
        </>
      )}
      {sortResult && <p className="muted">{sortResult}</p>}

      {confirmSort && (
        <Dialog
          title={`Розподілити ${plan.length} ${plural(plan.length, 'товар', 'товари', 'товарів')}?`}
          description={`Підкатегорія визначається за назвою товару. Раніше вибрані вручну категорії не змінюються. Скасувати одним рухом неможливо — виправлення робиться в картках окремо. Наприклад: ${plan.slice(0, 3).map(p => p.name).join(', ')}.`}
          confirmLabel="Розподілити"
          onConfirm={autoSort}
          onCancel={() => setConfirmSort(false)}
        />
      )}

      <form onSubmit={changePassword} className="stack">
        <h2>Пароль</h2>
        {/* Менеджер паролів привʼязує новий пароль до логіна з цього поля:
            без нього він не знав, для якого акаунта зберігати. */}
        <input type="email" name="username" autoComplete="username"
               value={email ?? ''} readOnly hidden />
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
          {status === 'busy' ? 'Збереження…' : 'Змінити пароль'}
        </button>
      </form>

      <h2>Сесія</h2>
      <button className="ghost" onClick={() => (pending ? setConfirmSignOut(true) : signOut())}>
        Вийти
      </button>

      {confirmSignOut && (
        <Dialog
          title="Вийти з акаунта?"
          description={`${pending} ${plural(pending, 'операція ще не надіслана', 'операції ще не надіслані', 'операцій ще не надіслано')}: їх зроблено без мережі. Після виходу вони зникнуть з пристрою і в облік не потраплять.`}
          confirmLabel="Вийти"
          tone="danger"
          onConfirm={() => { setConfirmSignOut(false); signOut() }}
          onCancel={() => setConfirmSignOut(false)}
        />
      )}
    </div>
  )
}
