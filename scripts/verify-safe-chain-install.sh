#!/usr/bin/env bash
set -euo pipefail

# Verifies CI dependency-installation parity locally in a disposable,
# throwaway directory:
#
#   1. `safe-chain setup-ci` followed by `npm ci` (malware blocking +
#      safe-chain's own minimum package release-age policy), both run with the
#      project's pinned npm version (`packageManager` in package.json) via
#      `npx`, so nothing is installed globally and nothing is added to project
#      dependencies.
#   2. `npm audit --audit-level=high` against the resulting lockfile.
#
# This mirrors the CI steps used across .github/workflows/*.yaml:
#   npm i -g @aikidosec/safe-chain && safe-chain setup-ci
#   npm ci
#   npm audit --audit-level=high
#
# Scope & limitations (read before changing this script):
#   - This checks dependency RESOLUTION and SUPPLY-CHAIN POLICY only. It is
#     not a substitute for `npm run jest`, `npm run build`, `npm run lint`,
#     or the mandatory local SonarQube scan — see docs/testing-guide.md and
#     docs/run-build-deploy.md. In particular, `npm run jest` never performs
#     a clean install and therefore cannot catch lockfile/registry/policy
#     drift on its own; this script is the local clean-install parity check.
#   - safe-chain's minimum release-age policy is safe-chain's own, and is
#     enforced independently of this repository's npm config — this repo
#     does NOT set npm's `min-release-age` (see .npmrc); only safe-chain
#     gates on package age here. That means a freshly published dependency
#     bump (e.g. a same-day/next-day framework patch release) can still fail
#     this check, or CI, purely because safe-chain has not yet aged it in,
#     even though plain `npm install`/`npm ci` would resolve it fine. A
#     failure of this specific kind is safe-chain doing its job, not a
#     script bug: wait for the release to clear safe-chain's window, or get
#     an explicit, documented policy exception. Do not respond to it by
#     removing safe-chain, pinning an older safe-chain release, or otherwise
#     bypassing it.
#   - The documented lockfile exception is the standing preview-lane
#     `--safe-chain-skip-minimum-package-age` override (PR preview, develop
#     preview, and smoke_prod on pull_request). Production deploy and
#     non-PR smoke keep the full age gate. See docs/run-build-deploy.md,
#     "Preview-Only Safe-Chain Minimum-Package-Age Override". To reproduce
#     that preview lockfile install locally, opt in with:
#       SAFE_CHAIN_SKIP_MINIMUM_PACKAGE_AGE=1 npm run verify:ci-install
#     This is off by default and only ever skips the minimum-package-age
#     gate — malware blocking and the npm audit step below are unaffected.
#     Do not set it to work around anything other than reproducing that
#     documented preview-lane policy.
#   - Runs `npm ci --ignore-scripts` because the disposable directory is not
#     a git worktree: the `prepare` (husky) lifecycle script requires `.git`
#     and would fail outside the real repo. Dependency lifecycle scripts are
#     therefore not exercised here; the real `npm ci` in CI and local
#     development already runs them against the actual repo.
#   - Uses an isolated `--cache` directory (also disposable, cleaned up with
#     the rest of the workdir) instead of the machine's shared `~/.npm`
#     cache. `npm ci` installs from the exact tarball URLs/integrity already
#     pinned in package-lock.json; if those tarballs (or their registry
#     metadata) are already sitting in the shared cache from an earlier,
#     unrelated, non-safe-chain install on this machine, npm can serve them
#     from disk without ever going back through safe-chain's registry proxy
#     — silently skipping both the malware scan and safe-chain's minimum
#     package-age check and producing a false pass. A dedicated empty cache
#     forces every run to actually go through safe-chain.
#   - Never lower `--audit-level`, skip safe-chain, or pin an old/vendored
#     safe-chain version just to make this script pass. If it fails, fix the
#     dependency versions (or get an explicit, documented policy exception)
#     — do not weaken the check itself.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [[ ! -f package.json || ! -f package-lock.json ]]; then
  echo "error: package.json / package-lock.json not found in $REPO_ROOT" >&2
  exit 1
fi

PACKAGE_MANAGER="$(node -p '
  const pm = require("./package.json").packageManager;
  if (!pm || !pm.startsWith("npm@")) {
    throw new Error("Expected packageManager to start with npm@, got: " + pm);
  }
  pm
')"
NPM_VERSION="${PACKAGE_MANAGER#npm@}"

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/emporix-verify-ci-install.XXXXXX")"
CACHE_DIR="$WORKDIR/.npm-cache"
mkdir -p "$CACHE_DIR"
cleanup() {
  rm -rf "$WORKDIR"
  return 0
}
trap cleanup EXIT

cp package.json "$WORKDIR/"
cp package-lock.json "$WORKDIR/"
if [[ -f .npmrc ]]; then
  cp .npmrc "$WORKDIR/"
fi

echo "==> Disposable clean-install path: $WORKDIR (isolated npm cache: $CACHE_DIR)"
echo "==> npm@${NPM_VERSION} (pinned via packageManager) + safe-chain (latest, unpinned to match CI), invoked via npx"

declare -a NPM_CI_ARGS=(npm ci --ignore-scripts --cache "$CACHE_DIR")
if [[ "${SAFE_CHAIN_SKIP_MINIMUM_PACKAGE_AGE:-0}" == "1" ]]; then
  NPM_CI_ARGS+=(--safe-chain-skip-minimum-package-age)
  echo "==> SAFE_CHAIN_SKIP_MINIMUM_PACKAGE_AGE=1: reproducing the preview-only override, skipping safe-chain's minimum-package-age gate only"
fi

pushd "$WORKDIR" >/dev/null

echo "==> safe-chain setup-ci"
npx --yes -p @aikidosec/safe-chain safe-chain setup-ci

echo "==> ${NPM_CI_ARGS[*]}"
npx --yes -p "npm@${NPM_VERSION}" "${NPM_CI_ARGS[@]}"

echo "==> npm audit --audit-level=high"
npx --yes -p "npm@${NPM_VERSION}" npm audit --audit-level=high --cache "$CACHE_DIR"

popd >/dev/null

echo "==> verify:ci-install passed: safe-chain setup-ci + npm ci + npm audit --audit-level=high succeeded"
echo "==> note: this only confirms today's lockfile clears safe-chain's own age/malware policy and audit;"
echo "    it is not a guarantee that a future 'npm install' bump of the same package will."
