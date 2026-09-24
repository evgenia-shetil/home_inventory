import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const demoClient = fileURLToPath(new URL('./src/demo/supabase.js', import.meta.url))

// Позначка збірки потрапляє і в код, і в окремий файл поруч. Застосунок
// порівнює їх і бачить, що на сервері вже інша версія: без цього
// телефон може місяцями показувати сторінку з кешу.
const buildId = String(Date.now())

export default defineConfig(({ mode }) => ({
  base: '/home_inventory/',
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    react(),
    // Демо-режим: справжній клієнт Supabase підміняється базою в памʼяті,
    // щоб перевіряти екрани без входу й без живих даних.
    mode === 'demo' && {
      name: 'demo-supabase',
      enforce: 'pre',
      async resolveId(source, importer, options) {
        if (!source.endsWith('/supabase.js') || importer?.includes('/src/demo/')) return null
        const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
        return resolved?.id.endsWith('/src/lib/supabase.js') ? demoClient : null
      },
    },
    {
      name: 'emit-version',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ buildId }),
        })
      },
    },
  ],
  test: {
    environment: 'jsdom',
    globals: true,
  },
}))
