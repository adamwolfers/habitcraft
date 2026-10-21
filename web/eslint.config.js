import js from '@eslint/js';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    'coverage/**',
    // Generated from shared/api-spec/openapi.yaml -- see .prettierignore.
    '**/*.generated.ts',
  ]),
  {
    files: ['**/*.{ts,tsx,js}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: { globals: globals.browser },
  },
  // Prettier formatting as a lint error, as in frontend/; last, so
  // eslint-config-prettier turns the stylistic rules above off.
  prettierRecommended,
]);
