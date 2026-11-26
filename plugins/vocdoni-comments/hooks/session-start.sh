#!/usr/bin/env bash
# SessionStart and SubagentStart hook for vocdoni-comments.
#
# Injects the comments skill body (SKILL.md, frontmatter dropped) into every session and subagent, so the
# rules apply when comments are one step of a task and the skill's description never matches.
# Reads the body from SKILL.md so there is one source of truth.
#
# Prints hookSpecificOutput JSON on stdout. Reads no input, writes nothing on error, never blocks, always exits 0.
# Plain bash 3.2 so it runs on stock macOS.

# Claude Code runs this for SessionStart and SubagentStart; the output must name the event it answers.
case "${1:-}" in
  SubagentStart) event=SubagentStart ;;
  *) event=SessionStart ;;
esac

script_dir=$(cd "$(dirname "$0")" 2>/dev/null && pwd)

skill=""
for root in "${CLAUDE_PLUGIN_ROOT:-}" "$script_dir/.."; do
  if [ -n "$root" ] && [ -r "$root/skills/comments/SKILL.md" ]; then
    skill="$root/skills/comments/SKILL.md"
    break
  fi
done
[ -n "$skill" ] || exit 0
trim="$(dirname "$skill")/trim.md"

# Drop control characters other than tab and newline, which json_escape would leave raw, then the
# frontmatter block (first line "---" up to the next "---"), then leading blank lines.
body=$(tr -d '\000-\010\013-\037' < "$skill" 2>/dev/null | awk 'NR == 1 && /^---$/ { fm = 1; next } fm && /^---$/ { fm = 0; next } !fm' | sed '/./,$!d')
[ -n "$body" ] || exit 0

tab=$(printf '\t')

json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e "s/$tab/\\\\t/g" | awk '{ printf "%s%s", (NR > 1 ? "\\n" : ""), $0 }'
}

msg="The vocdoni-comments plugin is installed. Follow these rules whenever you write or change a code comment, even as one step of a larger task. trim.md is not included here: before trimming or reviewing comments, load the comments skill (Skill tool, vocdoni-comments:comments), or read $trim if you have no Skill tool.

$body"

printf '{"hookSpecificOutput":{"hookEventName":"%s","additionalContext":"%s"}}\n' "$event" "$(json_escape "$msg")"
exit 0
