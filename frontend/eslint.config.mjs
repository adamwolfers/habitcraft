import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Enforce Prettier formatting as a lint error, and disable any stylistic
  // rules that would conflict with it. Must come after the Next configs so
  // eslint-config-prettier (bundled here) can turn those rules off last.
  prettierRecommended,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // CommonJS config files
    'jest.config.cjs',
    'jest.setup.js',
    // Generated files
    'coverage/**',
    // Generated from shared/api-spec/openapi.yaml -- see .prettierignore.
    '**/*.generated.ts',
  ]),
]);

export default eslintConfig;
