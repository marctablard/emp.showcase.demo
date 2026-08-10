import 'dotenv/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';

function isNextPublicClientDiGenerationEnabled() {
  const raw = (process.env.NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

const restrictPlatformClientImport = !isNextPublicClientDiGenerationEnabled();

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],
      '@typescript-eslint/no-explicit-any': 'off', // we are more lax about any-types, especially in regards to Mixins
      '@typescript-eslint/no-empty-object-type': 'off', //  Empty Object Types are necessary for specific Mapper<T,K> declarations
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }, // excluding unused variables which are prefixed with _ is common practice
      ],
      '@typescript-eslint/no-unsafe-function-type': 'off',
      'no-console': ['warn'], // Use Pino LoggerService instead of console.*. See docs/logging-guide.md
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...(restrictPlatformClientImport
              ? [
                  {
                    name: '@/platform/client',
                    message:
                      'Client Inversify container is off by default. Use @/lib/logger/browser-logger and @/lib/client/validation-registry, or set NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT=true, run npm run generate, and import the generated client container.',
                  },
                ]
              : []),
            {
              name: '@/lib/client/service',
              message: 'Removed. Use @/lib/logger/browser-logger or @/lib/client/validation-registry.',
            },
          ],
        },
      ],
      // Forbid reintroduction of `process.env.NEXT_PUBLIC_STORYBLOK_*` and
      // `process.env.NEXT_PUBLIC_CMS_*` reads. These keys were migrated to
      // server-only `NEXT_STORYBLOK_*` / `NEXT_CMS_*`; the browser obtains
      // token-dependent values through server-actions (see
      // src/app/_actions/storyblok-bridge.ts and
      // src/app/_actions/cms-banner.ts). Legacy PUBLIC fallback for server
      // resolution lives only in `src/lib/common/cms-dual-env.ts` (dynamic
      // `env[key]` — not caught by these literal selectors). Three AST
      // selectors cover the common access shapes: dot-notation, computed
      // (bracket) access, and destructuring. An aliased indirection
      // (`const e = process.env; e.NEXT_PUBLIC_STORYBLOK_*`) is intentionally
      // not caught at the AST level — that vector is covered by the
      // bundle-content audit in scripts/preview-smoke.sh. String literals
      // referencing the old names (e.g. source-text audits in test files)
      // are unaffected and test files are additionally excluded by
      // globalIgnores below.
      'no-restricted-syntax': [
        'error',
        {
          // Dot-notation: process.env.NEXT_PUBLIC_STORYBLOK_FOO
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/^NEXT_PUBLIC_(STORYBLOK|CMS)_/]",
          message:
            'process.env.NEXT_PUBLIC_STORYBLOK_* and process.env.NEXT_PUBLIC_CMS_* are deprecated. Use the server-only NEXT_STORYBLOK_* / NEXT_CMS_* keys server-side; in the browser, fetch values through a server-action (see src/app/_actions/storyblok-bridge.ts and src/app/_actions/cms-banner.ts).',
        },
        {
          // Computed (bracket) access: process.env['NEXT_PUBLIC_STORYBLOK_FOO']
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env'][computed=true][property.value=/^NEXT_PUBLIC_(STORYBLOK|CMS)_/]",
          message:
            'process.env.NEXT_PUBLIC_STORYBLOK_* and process.env.NEXT_PUBLIC_CMS_* are deprecated. Use the server-only NEXT_STORYBLOK_* / NEXT_CMS_* keys server-side; in the browser, fetch values through a server-action (see src/app/_actions/storyblok-bridge.ts and src/app/_actions/cms-banner.ts).',
        },
        {
          // Destructuring: const { NEXT_PUBLIC_STORYBLOK_FOO } = process.env
          selector:
            "VariableDeclarator[init.object.name='process'][init.property.name='env'] > ObjectPattern > Property[key.name=/^NEXT_PUBLIC_(STORYBLOK|CMS)_/]",
          message:
            'process.env.NEXT_PUBLIC_STORYBLOK_* and process.env.NEXT_PUBLIC_CMS_* are deprecated. Use the server-only NEXT_STORYBLOK_* / NEXT_CMS_* keys server-side; in the browser, fetch values through a server-action (see src/app/_actions/storyblok-bridge.ts and src/app/_actions/cms-banner.ts).',
        },
      ],
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    'node_modules/**',
    '.next/**',
    'out/**',
    'build/**',
    'playwright-report/**',
    'test-results/**',
    // Sonar scanner temp bundles — linting them OOMs Node (seen during concurrent local Sonar)
    '.scannerwork/**',
    'next-env.d.ts',
    'scripts/**',
    'specifications/**',
    'public/**',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.config.*s',
    '**/*.setup.js',
    '**/*.d.ts',
  ]),
]);

export default eslintConfig;
