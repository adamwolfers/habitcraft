const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const prettier = require('eslint-plugin-prettier');

module.exports = [
  // Global ignores must come first
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'coverage/**',
      '*.config.js',
      '.*.js',
      'babel.config.js',
      'metro.config.js',
      'jest.config.js',
      'jest.setup.js',
      // Generated from shared/api-spec/openapi.yaml by scripts/api-codegen.js.
      // Linting them would fight the generator: `npm run api:codegen -- --check`
      // compares the committed bytes against what the generator emits, so a
      // prettier --fix pass afterwards makes every run report drift.
      '**/*.generated.ts',
    ],
  },
  // TypeScript/TSX files configuration
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        // React Native globals
        __DEV__: 'readonly',
        // Node globals (for config files)
        module: 'readonly',
        require: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        // Jest globals
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react: react,
      'react-hooks': reactHooks,
      prettier: prettier,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...typescript.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'off',
      'prettier/prettier': 'error',
      // Disable base rule in favor of TypeScript version
      'no-unused-vars': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
];
