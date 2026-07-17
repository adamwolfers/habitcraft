const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  // Global ignores must come first
  {
    ignores: ['node_modules/**', 'coverage/**'],
  },

  // Application source: CommonJS running on Node
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      prettier,
    },
    rules: {
      ...js.configs.recommended.rules,
      // Turn off stylistic rules that would fight Prettier.
      ...prettierConfig.rules,
      'prettier/prettier': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // Test files additionally get Jest globals
  {
    files: ['**/*.test.js', 'jest.setup.js', 'jest.integration.setup.js', 'integration/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },

  // Express error middleware must declare 4 params to be recognised as an
  // error handler, so its unused `next` cannot be renamed or removed.
  {
    files: ['middleware/**/*.js', 'app.js'],
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$' }],
    },
  },
];
