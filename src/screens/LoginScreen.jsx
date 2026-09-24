import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { authErrorMessage } from '../domain/credentials.js'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  async function signInWithPassword(e) {
    e.preventDefault()
    setStatus('busy')
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(authErrorMessage(error))
      setStatus('idle')
    }
    // Успіх не обробляємо: onAuthStateChange в App підхопить сесію сам.
  }

  // Запасний шлях на випадок забутого пароля. Вбудована пошта Supabase
  // має жорсткий ліміт, тому це саме запасний варіант, а не основний.
  async function sendMagicLink() {
    if (!email) {
      setError('Пошта не вказана')
      return
    }
    setStatus('busy')
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href, shouldCreateUser: false },
    })

    setError(error ? authErrorMessage(error) : null)
    setStatus(error ? 'idle' : 'sent')
  }

  if (status === 'sent') {
    return (
      <main className="screen center">
        <h1>Лист надіслано</h1>
        <p className="muted">Посилання для входу відправлено на {email}.</p>
        <button className="ghost" onClick={() => setStatus('idle')}>Повернутись</button>
      </main>
    )
  }

  return (
    <main className="screen center">
      <h1>Запаси</h1>
      <form onSubmit={signInWithPassword} className="stack">
        {/* Підписи над полями, а не лише placeholder: він зникає з
            першою літерою, і автозаповнене поле неможливо впізнати. */}
        <label className="field">
          Пошта
          <input
            type="email" name="email" required value={email}
            autoComplete="username" spellCheck={false} autoCapitalize="none"
            onChange={e => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          Пароль
          <input
            type="password" name="password" required value={password}
            autoComplete="current-password" onChange={e => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" disabled={status === 'busy'}>
          {status === 'busy' ? 'Вхід…' : 'Увійти'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      <button className="link" onClick={sendMagicLink} disabled={status === 'busy'}>
        Увійти за посиланням на пошту
      </button>
    </main>
  )
}
