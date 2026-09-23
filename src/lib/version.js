// Сторінка може лишитись у кеші телефона надовго, і людина місяцями
// користується старою версією, не знаючи про це. Порівнюємо позначку
// збірки в коді з тією, що лежить на сервері.
const CURRENT = typeof __BUILD_ID__ === 'undefined' ? null : __BUILD_ID__

export async function hasNewerBuild() {
  if (!CURRENT) return false

  try {
    const url = `${import.meta.env.BASE_URL}version.json?t=${Date.now()}`
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) return false

    const { buildId } = await response.json()
    return Boolean(buildId) && buildId !== CURRENT
  } catch {
    // Немає звʼязку чи файлу — це не привід турбувати повідомленням.
    return false
  }
}
