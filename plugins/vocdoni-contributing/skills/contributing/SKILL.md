---
name: contributing
description: Use whenever writing or posting a pull request or merge request description, an issue, a code review, a review comment or a commit message, on GitHub, GitLab or any other git host, through gh, glab or the web, including as one step of a larger task. Sets how to introduce yourself as the agent acting for the user, length limits and structure for PRs, issues and reviews, and how to post a review.
---

# Contributing

These rules cover everything you write on the git host for the user: pull or merge request descriptions, issues, reviews, review comments and commits.

## Introduce yourself

Start every PR description, issue, review and comment you post with one line saying which model you are and who you act for, such as "This is {model} speaking on behalf of {owner}." or "{model} here, on behalf of {owner}." `{owner}` is the login of the host CLI's user (`gh api user -q .login`, `glab api user | jq -r .username`), else `git config user.name`. Don't sign off at the end.

Don't add a `Co-authored-by` trailer for yourself to commits. The person running you answers for the change.

## Pull requests

Keep descriptions under ~15 lines of markdown, code blocks included: what changed and why, any non-obvious decisions, how it was tested, and **one** usage example if the change has a user-facing surface. Skip anything the diff or README already says.

## Issues

Keep issues under ~15 lines of markdown too, code blocks included. Open with the problem in a sentence or two. For a bug, add what happens, what should happen and the shortest way to reproduce it. For a feature, add why it's needed and what "done" looks like. Then add pointers to the relevant code, PRs or issues, and a proposed approach if there's one. Quote only the log lines that matter, label guesses as guesses, and skip anything the title already says.

## Reviews

Each finding takes about three sentences: what's wrong, what it breaks, and the fix. Don't walk through every step of the reasoning or restate what the diff shows. Mark nits with "Nit:" and keep them shorter still. The review's summary body follows the same rule.

Post a review you were asked to publish as a review, not as a plain comment, and mark it "Approve" or "Request changes" depending on its outcome (on GitLab: approve, or leave the blocking threads unresolved). Write a bare `@name` only for a real login you mean to notify.
