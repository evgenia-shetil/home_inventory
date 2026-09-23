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
