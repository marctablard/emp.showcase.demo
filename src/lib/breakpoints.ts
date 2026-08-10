/**
 * Canonical breakpoint widths (px) — the single source of truth for all runtime
 * (JavaScript / TypeScript) viewport logic.
 *
 * These mirror the `--breakpoint-*` custom properties in `src/app/globals.css` (declared
 * there in `rem` for Tailwind's `sm`/`md`/`lg` variants). Tailwind v4 does NOT emit
 * `--breakpoint-*` as a runtime CSS custom property, so JS cannot read them at runtime —
 * the values are therefore duplicated here deliberately and kept in lock-step by
 * `breakpoints.test.ts`, which fails CI if CSS and TS diverge.
 *
 * There is intentionally no `xl`/`2xl`: the design system (Figma) defines four stages
 * only — mobile (default) / `sm` tablet / `md` desktop-min / `lg` desktop-max.
 */
export const breakpoints = {
  sm: 768, // tablet         — min-width 768px
  md: 1024, // desktop (min)  — min-width 1024px
  lg: 1280, // desktop (max)  — min-width 1280px
} as const;

export type Breakpoint = keyof typeof breakpoints;
