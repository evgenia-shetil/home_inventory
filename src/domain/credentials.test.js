import { describe, it, expect } from 'vitest'
import { validatePassword, authErrorMessage } from './credentials.js'

describe('validatePassword', () => {
  it('відхиляє короткий пароль', () => {
    expect(validatePassword('12345')).toBe('Пароль має бути не коротшим за 6 символів')
  })

  it('приймає пароль від 6 символів', () => {
    expect(validatePassword('123456')).toBeNull()
  })

  it('відхиляє порожній', () => {
    expect(validatePassword('')).toBe('Пароль не вказано')
  })
})

describe('authErrorMessage', () => {
  it('перекладає невірні дані', () => {
    expect(authErrorMessage({ message: 'Invalid login credentials' }))
      .toBe('Невірна пошта або пароль')
  })

  it('пояснює ліміт листів', () => {
    expect(authErrorMessage({ message: 'email rate limit exceeded' }))
      .toBe('Перевищено ліміт листів за годину. Доступний вхід за паролем')
  })

  it('пояснює закриту реєстрацію', () => {
    expect(authErrorMessage({ message: 'Signups not allowed for this instance' }))
      .toBe('Реєстрація закрита')
  })

  it('віддає оригінал, коли переклад невідомий', () => {
    expect(authErrorMessage({ message: 'Something odd' })).toBe('Something odd')
  })

  it('не падає без помилки', () => {
    expect(authErrorMessage(null)).toBeNull()
  })
})
