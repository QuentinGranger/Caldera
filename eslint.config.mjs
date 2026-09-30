import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  prettier,
  // Build output wherever it sits, and agent folders: their git worktrees
  // are other checkouts, each with its own .next build and config.
  globalIgnores([
    '**/.next/**',
    '.claude/**',
    '.codex/**',
    'src/generated/**',
    'next-env.d.ts',
  ]),
]);
