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
      setError('Спершу введи пошту')
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
        <h1>Перевір пошту</h1>
        <p className="muted">Посилання для входу надіслано на {email}.</p>
        <button className="ghost" onClick={() => setStatus('idle')}>Назад</button>
      </main>
    )
  }

  return (
    <main className="screen center">
      <h1>Запаси</h1>
      <form onSubmit={signInWithPassword} className="stack">
        <input
          type="email" required value={email} placeholder="пошта"
          autoComplete="username" onChange={e => setEmail(e.target.value)}
        />
        <input
          type="password" required value={password} placeholder="пароль"
          autoComplete="current-password" onChange={e => setPassword(e.target.value)}
        />
        <button type="submit" disabled={status === 'busy'}>
          {status === 'busy' ? 'Заходжу…' : 'Увійти'}
        </button>
        {error && <p className="error">{error}</p>}
      </form>

      <button className="link" onClick={sendMagicLink} disabled={status === 'busy'}>
        Забула пароль — надіслати посилання на пошту
      </button>
    </main>
  )
}
