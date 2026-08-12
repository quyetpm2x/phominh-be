// @ts-check
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';
import eslintPluginImport from 'eslint-plugin-import';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

// Mirror của web + app/web/packages/eslint-config/base.js (mục 7 tài liệu công nghệ FE) —
// backend là repo riêng nên không import được package đó, viết lại rule tương đương tại chỗ.
export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: eslintPluginImport,
    },
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
      'max-statements': ['error', 21],
      complexity: ['warn', 12],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // Rule quan trọng nhất theo tai-lieu-cong-nghe-backend.md/FE §7 — bắt lỗi quên `await` khi
      // gọi Prisma/API, lỗi im lặng nguy hiểm phổ biến ở luồng đăng bài/vote/report bất đồng bộ.
      '@typescript-eslint/no-floating-promises': 'error',
      'import/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc' },
        },
      ],
    },
  },
  {
    // File test gom nhiều `it()` trong 1 `describe()` — dài hơn 60 dòng là bình thường, không phải
    // dấu hiệu hàm sản phẩm quá phức tạp.
    files: ['**/*.spec.ts'],
    rules: {
      'max-lines-per-function': 'off',
    },
  },
  eslintPluginPrettier,
];
