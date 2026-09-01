import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'

// NOTE: typescript-eslint disabled temporarily — TS 7.0 not yet supported (https://github.com/typescript-eslint/typescript-eslint/issues/10940)
// Keep lint for JS/JSX only until upstream supports TS 7. TS files are type-checked via `tsc --noEmit` / `next build`.
// When TS 7 support lands, re-enable: import tseslint from 'typescript-eslint' and add **/*.{ts,tsx} override with ...tseslint.configs.recommended
export default defineConfig([
  globalIgnores(['.next', 'dist', 'out', 'coverage']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
