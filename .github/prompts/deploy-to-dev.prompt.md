---
description: "Stage all changes, commit with a session summary, and push to origin/dev."
agent: "agent"
tools: [run_in_terminal, get_changed_files]
argument-hint: "Optional: additional context for the commit message"
---

Deploy current changes to the dev branch:

1. Stage all changes: #run_in_terminal `git add .`
2. Review `git diff --stat HEAD` and `git diff HEAD` to identify what changed in this session.
3. Write a conventional-commit message summarising the session's changes (use `feat:`, `fix:`, `style:`, `docs:`, or `refactor:` prefix as appropriate).
4. Commit: #run_in_terminal `git commit -m "<generated message>"`
5. Push: #run_in_terminal `git push origin dev`
