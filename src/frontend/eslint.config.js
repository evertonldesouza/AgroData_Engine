import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.browser, ...globals.es2024, __APP_VERSION__: 'readonly' },
      parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
  },
  {
    files: ['*.config.js', 'src/**/*.test.{js,jsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
])
