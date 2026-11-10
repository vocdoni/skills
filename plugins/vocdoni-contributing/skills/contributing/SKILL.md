---
name: contributing
description: Use whenever starting work on a change in a repository, or writing or posting a pull request or merge request description, an issue, a code review, a review comment or a commit message, on GitHub, GitLab or any other git host, through gh, glab or the web, including as one step of a larger task. Sets how to tie the work to an issue (find one, or open one before the PR), how to introduce yourself as the agent acting for the user, length limits and structure for PRs, issues and reviews, and how to post a review.
---

# Contributing

These rules cover the issue that tracks your work and everything you write on the git host for the user: pull or merge request descriptions, issues, reviews, review comments and commits.

## Introduce yourself

Start every PR description, issue, review and comment you post with one line saying which model you are and who you act for, such as "This is {model} speaking on behalf of {owner}." or "{model} here, on behalf of {owner}." `{owner}` is the login of the host CLI's user (`gh api user -q .login`, `glab api user | jq -r .username`), else `git config user.name`. Don't sign off at the end.

Don't add a `Co-authored-by` trailer for yourself to commits. The person running you answers for the change.

## Track the work in an issue

Every change that ends in a PR links to an issue, so the work can be found later and isn't done twice. When you start, look for one that already covers it: the issue the user named, one linked from the branch (a host development link, or a name like `58-fix-x`) or from its open PR, else a search of the repository's issues, closed ones included (`gh issue list --state all --search "<keywords>"`, `glab issue list --all --search "<keywords>"`). Reopen a fitting issue that was completed if the problem is back; if it was closed as not planned, tell the user before going on. If none fits, open one following the rules below just before you open the PR. When the work will not end in a PR, ask the user before opening an issue.

Link the issue from the PR description: `Closes #N` when the PR finishes it, `Refs #N` when it is one part. When an issue exists but there is no PR, put the same line in the final commit message. Questions, reviews and other work that changes nothing need no issue. If the repository has issues disabled, or you cannot search or create them, say so and carry on without one.

## Pull requests

Keep descriptions under ~15 lines of markdown, code blocks included: what changed and why, any non-obvious decisions, how it was tested, and **one** usage example if the change has a user-facing surface. Skip anything the diff or README already says.

## Issues

Keep issues under ~15 lines of markdown too, code blocks included. Open with the problem in a sentence or two. For a bug, add what happens, what should happen and the shortest way to reproduce it. For a feature, add why it's needed and what "done" looks like. Then add pointers to the relevant code, PRs or issues, and a proposed approach if there's one. Quote only the log lines that matter, label guesses as guesses, and skip anything the title already says.

## Reviews

Each finding takes about three sentences: what's wrong, what it breaks, and the fix. Don't walk through every step of the reasoning or restate what the diff shows. Mark nits with "Nit:" and keep them shorter still. The review's summary body follows the same rule.

Post a review you were asked to publish as a review, not as a plain comment, and mark it "Approve" or "Request changes" depending on its outcome (on GitLab: approve, or leave the blocking threads unresolved). Write a bare `@name` only for a real login you mean to notify.
