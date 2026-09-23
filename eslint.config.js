import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'

// Мінімальний набір: ловить те, що збірка пропускає — звернення до
// неоголошених імен після перейменувань і поламані правила хуків.
export default [
  js.configs.recommended,
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly', fetch: 'readonly' },
    },
    rules: { 'no-unused-vars': 'warn' },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        localStorage: 'readonly', fetch: 'readonly', console: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly', process: 'readonly',
        requestAnimationFrame: 'readonly', createImageBitmap: 'readonly',
        File: 'readonly', Blob: 'readonly', confirm: 'readonly', Intl: 'readonly',
        __BUILD_ID__: 'readonly',
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
    },
  },
]
