/**
 * Severity level for a validation item.
 * - `'error'` — causes build failure (Tier 1) or process exit (Tier 2)
 * - `'warning'` — logged but does not block startup/build
 */
export type ValidationSeverity = 'error' | 'warning';

/** A single check result within a healthcheck tier. */
export interface HealthcheckItem {
  /** Human-readable identifier (e.g. env var name or site code). */
  name: string;
  /** Whether this particular check passed. */
  passed: boolean;
  /** How severe a failure is. */
  severity: ValidationSeverity;
  /** Descriptive message (e.g. "NEXTAUTH_SECRET — missing"). */
  message: string;
}

/** Aggregated result for one validation tier. */
export interface HealthcheckResult {
  /** Which tier produced these results. */
  tier: 'env' | 'remote';
  /** Individual check items. */
  items: HealthcheckItem[];
  /** `true` when at least one item has `severity: 'error'` and `passed: false`. */
  hasErrors: boolean;
  /** `true` when at least one item has `severity: 'warning'` and `passed: false`. */
  hasWarnings: boolean;
}

/** Describes an environment variable to validate. */
export interface EnvVarDefinition {
  /** The environment variable key (e.g. `NEXT_PUBLIC_EMPORIX_TENANT`). */
  key: string;
  /** How severe it is when this variable is missing. */
  severity: ValidationSeverity;
  /** Short explanation of what this variable is for. */
  description: string;
}
