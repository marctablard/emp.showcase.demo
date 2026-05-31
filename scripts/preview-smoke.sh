#!/usr/bin/env bash
#
# EMP-15 Phase F · STEP 2 — Edge-Bundle-Guard (deferred via EMP-20).
#
# Acceptance: the Storyblok SDK (`@storyblok/*`) must NEVER enter the Edge
# middleware bundle, for ANY CMS provider. The site middleware
# (`src/site/middleware.ts`) imports the preview DETECTOR registry, whose
# module graph is the pure, edge-safe `storyblok-preview-detection` — never the
# SDK or the `server-only` adapter. This guard builds the app under each
# provider and asserts the compiled middleware contains zero `@storyblok`
# references.
#
# No secrets required. Runs `next build` (build:next) three times — minutes, not
# seconds — so it is opt-in (EMP-20 STEP 4), not part of the default CI lane.
#
# Usage:
#   ./scripts/preview-smoke.sh
# Exit code 0 = all three bundles clean; non-zero = at least one leak (or build
# failure).

set -euo pipefail

cd "$(dirname "$0")/.."

BUILD_IDS=(storyblok none mock)
MIDDLEWARE=".next/server/middleware.js"
NEEDLE='@storyblok'

# The DI container is codegen'd; `next build` (build:next) assumes it exists.
# Generate once up front so a clean checkout doesn't fail the first build.
echo "▶ generating DI container (one-off)…"
npm run generate >/dev/null

failures=0

for id in "${BUILD_IDS[@]}"; do
  echo ""
  echo "════════════════════════════════════════════════════════════"
  echo "▶ BUILD_ID=${id} — NEXT_CMS_PROVIDER=${id} npm run build:next"
  echo "════════════════════════════════════════════════════════════"

  rm -rf .next

  if ! NEXT_CMS_PROVIDER="${id}" npm run build:next; then
    echo "✗ [${id}] build failed"
    failures=$((failures + 1))
    continue
  fi

  if [[ ! -f "${MIDDLEWARE}" ]]; then
    # No middleware bundle emitted ⇒ trivially zero @storyblok references.
    echo "✓ [${id}] no ${MIDDLEWARE} emitted — 0 ${NEEDLE} references (pass)"
    continue
  fi

  # grep -c prints the count and exits 1 on zero matches; `|| true` keeps
  # `set -e` happy so we can assert on the count ourselves.
  count="$(grep -c "${NEEDLE}" "${MIDDLEWARE}" || true)"

  if [[ "${count}" == "0" ]]; then
    echo "✓ [${id}] ${MIDDLEWARE}: 0 ${NEEDLE} references (pass)"
  else
    echo "✗ [${id}] ${MIDDLEWARE}: ${count} ${NEEDLE} reference(s) LEAKED into the edge bundle"
    grep -n "${NEEDLE}" "${MIDDLEWARE}" | head -5 || true
    failures=$((failures + 1))
  fi
done

echo ""
echo "════════════════════════════════════════════════════════════"
if [[ "${failures}" -eq 0 ]]; then
  echo "✓ ALL ${#BUILD_IDS[@]} provider bundles are @storyblok-free."
  exit 0
fi
echo "✗ ${failures} provider build(s) failed the edge-bundle guard."
exit 1
