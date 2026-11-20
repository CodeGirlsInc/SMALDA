#!/usr/bin/env bash
# Fail if a .rs file under src/ is not reachable from lib.rs / main.rs.
# A file nobody declares as a module is never compiled, so its tests never run.
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0
while IFS= read -r f; do
  rel="${f#src/}"
  case "$rel" in lib.rs|main.rs) continue ;; esac
  dir="$(dirname "$rel")"
  base="$(basename "$rel" .rs)"
  if [ "$base" = "mod" ]; then
    # src/a/b/mod.rs is declared as `mod b;` in src/a/mod.rs (or lib.rs for src/b/mod.rs)
    name="$(basename "$dir")"
    parent="$(dirname "$dir")"
  else
    name="$base"
    parent="$dir"
  fi
  if [ "$parent" = "." ]; then
    candidates="src/lib.rs src/main.rs"
  else
    candidates="src/$parent/mod.rs src/$parent.rs"
  fi
  found=0
  for c in $candidates; do
    if [ -f "$c" ] && grep -Eq "^[[:space:]]*(pub(\([a-z]+\))?[[:space:]]+)?mod[[:space:]]+${name}[[:space:]]*;" "$c"; then
      found=1
    fi
  done
  if [ "$found" -eq 0 ]; then
    echo "ERROR: $f is not declared as a module (it is never compiled)"
    fail=1
  fi
done < <(find src -name '*.rs' | sort)

exit "$fail"
