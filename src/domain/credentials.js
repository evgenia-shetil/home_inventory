// Мінімум задає сам Supabase (Authentication → Email → Minimum password length).
const MIN_LENGTH = 6

export function validatePassword(password) {
  if (!password) return 'Пароль не вказано'
  if (password.length < MIN_LENGTH) {
    return `Пароль має бути не коротшим за ${MIN_LENGTH} символів`
  }
  return null
}

// Supabase віддає помилки англійською і технічною мовою. Тут лише ті,
// які користувачка справді може побачити, з поясненням що робити далі.
const MESSAGES = [
  ['Invalid login credentials', 'Невірна пошта або пароль'],
  ['email rate limit exceeded', 'Перевищено ліміт листів за годину. Доступний вхід за паролем'],
  ['Signups not allowed', 'Реєстрація закрита'],
  ['Email not confirmed', 'Пошта не підтверджена'],
  ['same as the old password', 'Новий пароль збігається зі старим'],
]

export function authErrorMessage(error) {
  if (!error) return null
  const found = MESSAGES.find(([needle]) => error.message?.includes(needle))
  return found ? found[1] : error.message
}
