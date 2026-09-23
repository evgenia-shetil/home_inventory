import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { validatePassword, authErrorMessage } from '../domain/credentials.js'

export default function SettingsScreen({ email }) {
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

  return (
    <div className="stack">
      <h1>Ще</h1>
      <p className="muted">Ти увійшла як {email}</p>

      <h2>Категорії</h2>
      <Link to="/categories"><button type="button" className="ghost">Керувати категоріями</button></Link>

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
