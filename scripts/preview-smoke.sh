#!/usr/bin/env bash
#
# Browser-bundle + edge-middleware drift guard for the CMS migration.
#
# Two acceptance contracts, asserted per CMS provider:
#
#   (1) Edge bundle: the Storyblok SDK (`@storyblok/*`) must NEVER enter the
#       Edge middleware bundle. The site middleware imports the pure,
#       edge-safe `storyblok-preview-detection` — never the SDK or the
#       `server-only` adapter.
#
#   (2) Browser bundle: the deprecated `NEXT_PUBLIC_STORYBLOK_*` and
#       `NEXT_PUBLIC_CMS_*` env reads must NEVER appear in
#       `.next/static/chunks/*.js`, nor may the demo access token leak.
#       The browser obtains token-dependent values through server-actions
#       (see src/app/_actions/storyblok-bridge.ts, cms-banner.ts).
#
# No secrets required. Runs `next build` (build:next) three times — minutes,
# not seconds — so it is opt-in, not part of the default CI lane.
#
# Usage:
#   ./scripts/preview-smoke.sh
# Exit code 0 = all bundles clean; non-zero = at least one leak (or build
# failure).

set -euo pipefail

cd "$(dirname "$0")/.."

BUILD_IDS=(storyblok none mock)
MIDDLEWARE=".next/server/middleware.js"
NEEDLE='@storyblok'
CLIENT_CHUNKS_GLOB=".next/static/chunks/*.js"

# Browser-bundle needles: deprecated env-var prefixes + the demo access token
# from .env.template. The demo token doubles as a leak sentinel — its presence
# in any client chunk proves a server-only value was inlined into the browser
# bundle even if the env-var rename was missed somewhere.
CLIENT_NEEDLES=(
  'NEXT_PUBLIC_STORYBLOK_'
  'NEXT_PUBLIC_CMS_'
  'uvTlxgRrZDSUyr4zftdoNgtt'
)

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
  else
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
  fi

  # ── Browser-bundle guard ────────────────────────────────────────────────
  # Assert that no deprecated env-var prefix and no demo token survived into
  # any client chunk. Runs even when no middleware was emitted (a provider
  # without middleware still ships client bundles).
  if ! compgen -G "${CLIENT_CHUNKS_GLOB}" > /dev/null; then
    echo "✓ [${id}] no client chunks emitted — browser-bundle guard skipped"
  else
    for needle in "${CLIENT_NEEDLES[@]}"; do
      # grep -rc on a glob prints one `path:count` line per file. Sum the
      # counts to get the total across all chunks. awk's `sum+=$2` handles
      # the empty-stdout case (no files matched) via `END {print sum+0}`.
      client_count="$(grep -rc "${needle}" ${CLIENT_CHUNKS_GLOB} 2>/dev/null | awk -F: '{sum+=$2} END {print sum+0}')"

      if [[ "${client_count}" == "0" ]]; then
        echo "✓ [${id}] .next/static/chunks: 0 hits for '${needle}'"
      else
        echo "✗ [${id}] .next/static/chunks: ${client_count} hits LEAKED for '${needle}'"
        grep -rln "${needle}" ${CLIENT_CHUNKS_GLOB} 2>/dev/null | head -5 || true
        failures=$((failures + 1))
      fi
    done
  fi
done

echo ""
echo "════════════════════════════════════════════════════════════"
if [[ "${failures}" -eq 0 ]]; then
  echo "✓ ALL ${#BUILD_IDS[@]} provider builds passed the edge + browser bundle guards."
  exit 0
fi
echo "✗ ${failures} guard check(s) failed across ${#BUILD_IDS[@]} provider build(s)."
exit 1
