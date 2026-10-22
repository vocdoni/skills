#!/usr/bin/env bash
# Write the brief for one plan task: <repo>/.delivery/<topic>/task-<N>-brief.md
# Usage: task-brief.sh <plan-file> <N>
# The brief contains the plan's header (everything before the first "## " heading, including an
# inline spec for Bounded work), Global Constraints, Review Focus and "### Task N" section, plus
# every ledger ruling whose scope names Task N or is global. Re-run it after adding rulings.
# Headings inside ``` or ~~~ fences are ignored, so code blocks can't cut a section short.
set -euo pipefail

if [[ $# -ne 2 || ! $2 =~ ^[0-9]+$ ]]; then
  echo "usage: $(basename "$0") <plan-file> <task-number>" >&2
  exit 2
fi

[[ -f $1 ]] || { echo "plan not found: $1" >&2; exit 1; }
plan=$(cd -- "$(dirname -- "$1")" && pwd -P)/$(basename -- "$1")
n=$2
root=$(git -C "$(dirname -- "$plan")" rev-parse --show-toplevel 2>/dev/null) || {
  echo "plan is not inside a git repository: $plan" >&2
  exit 1
}
name=$(basename -- "$plan" .md); name=${name%-design}; name=${name%-plan}
ws="$root/.delivery/$name"
ledger="$ws/progress.md"
[[ -f $ledger ]] || {
  echo "no ledger at $ledger; run init-workspace.sh first" >&2
  exit 1
}

# section h2 <title>: print the "## <title>" section.
# section task <N>:   print the "### Task <N>" section.
# Plain POSIX regexes only, so this works with mawk as well as gawk.
section() {
  awk -v kind="$1" -v arg="$2" '
    /^(```|~~~)/ { fence = !fence }
    !fence && /^##?#? / {
      if (on) {
        if (kind == "task") exit
        if (kind == "h2" && /^##? /) exit
      }
      if (kind == "h2" && $0 ~ ("^## " arg "[ \t]*$")) on = 1
      if (kind == "task" && $0 ~ ("^### Task " arg "([^0-9]|$)")) on = 1
    }
    on { print }
  ' "$plan"
}

task=$(section task "$n")
[[ -n $task ]] || { echo "no '### Task $n' section in $plan" >&2; exit 1; }
preamble=$(awk '/^(```|~~~)/ { fence = !fence } !fence && /^## / { exit } { print }' "$plan")
constraints=$(section h2 "Global Constraints")
focus=$(section h2 "Review Focus")
# Accept "(Task N)", "(global)", comma lists such as "(Task 1, Task 3)", and any case.
rulings=$(grep -iE "^Ruling R[0-9]+ \(([^)]*[^0-9])?(Task $n|global)([^0-9][^)]*)?\)" "$ledger" || true)
plan_sha=$(git -C "$root" log -1 --format=%h -- "$plan" 2>/dev/null || true)
patch_file="$ws/patches/task-$n.patch"

out="$ws/task-$n-brief.md"
{
  echo "# Brief: Task $n"
  echo "Plan: ${plan#"$root"/} @ ${plan_sha:-uncommitted}"
  if [[ -f $patch_file ]]; then echo "Patch: $patch_file"; fi
  echo "Generated: $(date '+%F %H:%M')  (do not edit; regenerate with task-brief.sh)"
  echo
  echo "This brief is your single source of requirements. Rulings override the task text"
  echo "where they conflict."
  echo
  echo "## Rulings for this task"
  if [[ -n $rulings ]]; then echo "$rulings" | sed 's/^/- /'; else echo "None."; fi
  echo
  echo "## Plan header"
  echo "$preamble"
  echo
  if [[ -n $constraints ]]; then echo "$constraints"; echo; fi
  if [[ -n $focus ]]; then echo "$focus"; echo; fi
  echo "$task"
} > "$out"

echo "$out"
[[ -n $constraints ]] || echo "warning: plan has no '## Global Constraints' section" >&2
[[ -n $plan_sha ]] || echo "warning: plan is not committed" >&2
