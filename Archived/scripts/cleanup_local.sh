#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'USAGE'
Usage:
  scripts/cleanup_local.sh --dry-run
  scripts/cleanup_local.sh --apply

What it does (safe/local only):
  - Deletes local build/cache folders that are always regeneratable:
      node_modules/ .next/ backend/node_modules/ backend/dist/
  - Deletes the local leftover folder voxanne-dashboard/ (already removed from git)
  - Deletes common local caches:
      .pytest_cache/ .venv/ venv/ __pycache__/

It does NOT touch:
  - src/, public/, backend/src/, .claude/, docs/
  - Any config files (package.json, next.config.mjs, etc.)
USAGE
}

MODE=""
if [[ ${1:-} == "--dry-run" ]]; then
  MODE="dry"
elif [[ ${1:-} == "--apply" ]]; then
  MODE="apply"
else
  usage
  exit 2
fi

TARGETS=(
  "${ROOT_DIR}/node_modules"
  "${ROOT_DIR}/.next"
  "${ROOT_DIR}/backend/node_modules"
  "${ROOT_DIR}/backend/dist"
  "${ROOT_DIR}/voxanne-dashboard"
  "${ROOT_DIR}/.pytest_cache"
  "${ROOT_DIR}/.venv"
  "${ROOT_DIR}/venv"
  "${ROOT_DIR}/__pycache__"
)

echo "Repo root: ${ROOT_DIR}"

echo "Targets:"
for t in "${TARGETS[@]}"; do
  if [[ -e "$t" ]]; then
    echo "  - EXISTS: ${t#${ROOT_DIR}/}"
  else
    echo "  - missing: ${t#${ROOT_DIR}/}"
  fi
done

echo ""
if [[ "$MODE" == "dry" ]]; then
  echo "Dry run only. No changes made."
  exit 0
fi

echo "Applying deletes..."
for t in "${TARGETS[@]}"; do
  if [[ -e "$t" ]]; then
    rm -rf "$t"
    echo "Deleted: ${t#${ROOT_DIR}/}"
  fi
done

echo ""
echo "Done. Next steps (if needed):"
echo "  - Frontend: npm install && npm run build"
echo "  - Backend:  (cd backend && npm install && npm run build)"
