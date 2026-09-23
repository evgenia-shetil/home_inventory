import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Позначка збірки потрапляє і в код, і в окремий файл поруч. Застосунок
// порівнює їх і бачить, що на сервері вже інша версія: без цього
// телефон може місяцями показувати сторінку з кешу.
const buildId = String(Date.now())

export default defineConfig({
  base: '/home_inventory/',
  define: { __BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    react(),
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
})
