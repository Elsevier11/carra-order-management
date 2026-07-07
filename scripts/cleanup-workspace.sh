#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=0
DOCKER=0
AGGRESSIVE=0
PRUNE_VOLUMES=0

usage() {
  cat <<'EOF'
Usage: cleanup-workspace.sh [--dry-run] [--docker] [--aggressive] [--volumes]

Deletes only build/cache artifacts inside the repository:
  - node_modules
  - dist
  - .turbo
  - coverage
  - frontend/node_modules
  - frontend/dist
  - frontend/.angular
  - frontend/.vite
  - frontend/coverage

Optional Docker cleanup:
  --docker      prune stopped containers, builder cache and unused images
  --aggressive  also run docker image prune -af and docker builder prune -af
  --volumes     also prune unused Docker volumes

Use --dry-run first to preview the actions.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      ;;
    --docker)
      DOCKER=1
      ;;
    --aggressive)
      DOCKER=1
      AGGRESSIVE=1
      ;;
    --volumes)
      DOCKER=1
      PRUNE_VOLUMES=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

if [[ ! -d "$ROOT_DIR/.git" ]]; then
  echo "Repository root not found from $SCRIPT_DIR" >&2
  exit 1
fi

cleanup_path() {
  local rel_path="$1"
  local abs_path="$ROOT_DIR/$rel_path"
  if [[ -e "$abs_path" ]]; then
    case "$abs_path" in
      "$ROOT_DIR"/*) ;;
      *)
      echo "Refusing to delete outside repo: $abs_path" >&2
      exit 1
        ;;
    esac
    if [[ $DRY_RUN -eq 1 ]]; then
      echo "[dry-run] rm -rf -- $rel_path"
    else
      rm -rf -- "$abs_path"
      echo "removed $rel_path"
    fi
  fi
}

cd "$ROOT_DIR"

targets=(
  "node_modules"
  "dist"
  ".turbo"
  "coverage"
  "frontend/node_modules"
  "frontend/dist"
  "frontend/.angular"
  "frontend/.vite"
  "frontend/coverage"
)

echo "Repository root: $ROOT_DIR"
for target in "${targets[@]}"; do
  cleanup_path "$target"
done

if [[ $DOCKER -eq 1 ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker not found, skipping Docker prune."
    exit 0
  fi

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "[dry-run] docker container prune -f"
    echo "[dry-run] docker builder prune -f"
    echo "[dry-run] docker image prune -f"
    if [[ $PRUNE_VOLUMES -eq 1 ]]; then
      echo "[dry-run] docker volume prune -f"
    fi
    if [[ $AGGRESSIVE -eq 1 ]]; then
      echo "[dry-run] docker builder prune -af"
      echo "[dry-run] docker image prune -af"
    fi
    exit 0
  fi

  docker container prune -f
  docker builder prune -f
  docker image prune -f
  if [[ $PRUNE_VOLUMES -eq 1 ]]; then
    docker volume prune -f
  fi
  if [[ $AGGRESSIVE -eq 1 ]]; then
    docker builder prune -af
    docker image prune -af
  fi
fi
