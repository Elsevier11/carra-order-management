import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

const sharedGlobals = {
  ...globals.browser,
  ...globals.node,
};

export default [
  {
    ignores: [
      'dist/**',
      'frontend/.angular/**',
      'frontend/dist/**',
      'node_modules/**',
      'frontend/node_modules/**',
      '.claude/**',
      '.continue/**',
      '.impeccable/**',
    ],
  },
  {
    files: ['frontend/src/**/*.spec.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jasmine,
      },
    },
  },
  {
    files: ['src/**/*.{js,mjs,cjs,ts,cts,mts}', 'frontend/src/**/*.{js,mjs,cjs,ts,cts,mts}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: sharedGlobals,
      parser: tsParser,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
