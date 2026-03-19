import type { EnvVarDefinition, HealthcheckItem, HealthcheckResult } from './types';

/**
 * Environment variables that **must** be present for the application to function.
 * Missing any of these causes a build failure (Tier 1).
 */
export const REQUIRED_ENV_VARS: ReadonlyArray<EnvVarDefinition> = [
  { key: 'NEXT_PUBLIC_EMPORIX_BASE_URL', severity: 'error', description: 'Emporix API base URL' },
  { key: 'NEXT_PUBLIC_EMPORIX_TENANT', severity: 'error', description: 'Emporix tenant identifier' },
  { key: 'NEXT_PUBLIC_EMPORIX_CLIENT_ID', severity: 'error', description: 'Emporix public/storefront client ID' },
  { key: 'NEXTAUTH_SECRET', severity: 'error', description: 'NextAuth session encryption secret' },
  { key: 'NEXT_PUBLIC_DEFAULT_CURRENCY', severity: 'error', description: 'Default currency code' },
  { key: 'NEXT_PUBLIC_DEFAULT_LANGUAGE', severity: 'error', description: 'Default language code' },
  { key: 'NEXT_PUBLIC_DEFAULT_COUNTRY', severity: 'error', description: 'Default country code' },
  {
    key: 'NEXT_PUBLIC_AVAILABLE_SITES',
    severity: 'error',
    description: 'Comma-separated list of available site codes',
  },
];

/**
 * Environment variables that are recommended but not strictly required.
 * Missing these produces warnings but does not fail the build.
 */
export const OPTIONAL_ENV_VARS: ReadonlyArray<EnvVarDefinition> = [
  {
    key: 'NEXT_PUBLIC_DEFAULT_SITE',
    severity: 'warning',
    description:
      'Default site code (resolved from NEXT_PUBLIC_AVAILABLE_SITES[0] if absent and turns off fallback to default site)',
  },
  { key: 'NEXT_EMPORIX_CLIENT_ID', severity: 'warning', description: 'Emporix server-side client ID' },
  { key: 'NEXT_EMPORIX_CLIENT_SECRET', severity: 'warning', description: 'Emporix server-side client secret' },
];

/**
 * Validate all required and optional environment variables against `process.env`.
 *
 * This is a **pure function** — it returns data only and does not log, throw,
 * or call `process.exit`. The caller decides how to report the results.
 *
 * @returns A `HealthcheckResult` summarising which variables are present/missing.
 */
export function validateEnvVars(): HealthcheckResult {
  const allVars: ReadonlyArray<EnvVarDefinition> = [...REQUIRED_ENV_VARS, ...OPTIONAL_ENV_VARS];

  const items: HealthcheckItem[] = allVars.map((def) => {
    const value = process.env[def.key];
    const present = value !== undefined && value.trim() !== '';
    return {
      name: def.key,
      passed: present,
      severity: def.severity,
      message: present ? `${def.key} — present` : `${def.key} — missing (${def.description})`,
    };
  });

  return {
    tier: 'env',
    items,
    hasErrors: items.some((item) => !item.passed && item.severity === 'error'),
    hasWarnings: items.some((item) => !item.passed && item.severity === 'warning'),
  };
}
