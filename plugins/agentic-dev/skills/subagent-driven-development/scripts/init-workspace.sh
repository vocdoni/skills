#!/usr/bin/env bash
# Create the delivery workspace for a spec or plan: <repo>/.delivery/<topic>/ with a ledger.
# Usage: init-workspace.sh <spec-or-plan-file>
# <topic> is the file name without .md and without a trailing -design or -plan, so a spec and
# its plan share one workspace. Idempotent: never overwrites an existing ledger; when run on a
# plan after the spec, it only adds the "Plan:" header line. Keeps .delivery/ out of git through
# .git/info/exclude, so no tracked file changes.
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $(basename "$0") <spec-or-plan-file>" >&2
  exit 2
fi

[[ -f $1 ]] || { echo "file not found: $1" >&2; exit 1; }
doc=$(cd -- "$(dirname -- "$1")" && pwd -P)/$(basename -- "$1")

root=$(git -C "$(dirname -- "$doc")" rev-parse --show-toplevel 2>/dev/null) || {
  echo "not inside a git repository: $doc" >&2
  exit 1
}
name=$(basename -- "$doc" .md); name=${name%-design}; name=${name%-plan}
ws="$root/.delivery/$name"
mkdir -p -- "$ws"

exclude=$(git -C "$root" rev-parse --git-path info/exclude)
[[ $exclude = /* ]] || exclude="$root/$exclude"
mkdir -p -- "$(dirname -- "$exclude")"
grep -qxF '.delivery/' "$exclude" 2>/dev/null || echo '.delivery/' >> "$exclude"

rel=${doc#"$root"/}
ledger="$ws/progress.md"
if [[ -e $ledger ]]; then
  if ! grep -qxF "# Ledger: $rel" "$ledger" && ! grep -q '^Plan: ' "$ledger" \
     && [[ $rel == *-plan.md || $rel == */plans/* ]]; then
    # Insert "Plan: <rel>" as line 2; portable across GNU and BSD sed.
    { head -n 1 "$ledger"; echo "Plan: $rel"; tail -n +2 "$ledger"; } > "$ledger.tmp"
    mv -- "$ledger.tmp" "$ledger"
    echo "ledger exists, added Plan: $rel"
  else
    echo "ledger exists, left untouched: $ledger"
  fi
else
  class=$(grep -m1 -oE '^Class: *[a-z]+' "$doc" | sed 's/^Class: *//' || true)
  branch=$(git -C "$root" branch --show-current)
  base=$(git -C "$root" rev-parse --short HEAD)
  cat > "$ledger" <<EOF
# Ledger: $rel
Class: ${class:-<spike|bounded|architectural>}   Branch: ${branch:-<detached>}
Repos: $root @ $base
Budget: <dispatches> dispatches / <audits> audits   Used: 0 / 0
Models: auditor=<value>  strong=<value>  standard=<value>  fast=<value>   (resolve with references/models.md)
Created: $(date +%F)

## Lifecycle
- [ ] 1. Explore and brainstorm; class stated to the owner; model roles resolved
- [ ] 2. Spec written and committed (Bounded: short spec inline at the top of the plan)
- [ ] 3. Spec audit folded in; owner approved the spec †
- [ ] 4. Plan drafted against the real code and committed; feature branch(es) created from the recorded base
- [ ] 5. Pre-flight audit turned into rulings †
- [ ] 6. Owner reviewed the plan
- [ ] 7. Tasks executed and each one reviewed by the controller
- [ ] 8. Full suite green; gate audit; fixes re-reviewed
- [ ] 9. Owner OK; merged; released
(† = skipped for Bounded work)

## Log
EOF
  echo "ledger created: $ledger"
fi
echo "workspace: $ws"
