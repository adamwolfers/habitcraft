# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Git Workflow: Trunk-Based Development

This project uses **trunk-based development**. Work directly on `master` in
`/Users/afw/github/habitcraft` and commit there in small increments. Do NOT create
feature branches or git worktrees for routine work. See CLAUDE.md for details.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push    # .husky/pre-push pushes beads data to the Dolt remote first,
               # and blocks the git push if that fails (habitcraft-8t8)
   git status  # MUST show "up to date with origin"
   ```
   A session with **no commits** never reaches `pre-push`. Those are covered by
   the `SessionEnd`/`SessionStart` hooks in `.claude/settings.json`
   (habitcraft-clj) — see CLAUDE.md "Claude Code hooks". If `.beads/push.log`
   shows a `FAILED` block, the beads data did NOT reach the remote; fix it
   rather than assuming the hook handled it. `.beads/push-history.log` is the
   append-only trace showing which hook fired and when.
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->

## Knowledge & Task Tracking (authoritative)

Beads is the single source of truth for this repo. This section sits **outside**
the managed Beads block above so it survives regeneration, and it is deliberate
— it is not an accidental conflict to be "fixed" by reverting to defaults.

- **Persistent knowledge:** use `bd remember` / `bd recall`. Do not use
  file-based memory (`MEMORY.md` or `~/.claude/.../memory/`) for this project,
  even if the agent harness provides one by default.
- **Task tracking:** use `bd create` / `bd update`. Do not use TodoWrite,
  TaskCreate, or markdown TODO lists, including for short-lived checklists.

Rationale: knowledge and work items stay in the Dolt database, sync to the git
remote via `bd dolt push`, and restore with `bd init --remote <url>`. Harness
memory is per-machine and would not travel with the repo.

Note that `bd dolt push` is separate from `git push` — issue data lives in
`refs/dolt/data` and a plain `git push` does not carry it.

### If a harness memory store exists anyway

The agent harness writes `~/.claude/projects/-Users-afw-github-habitcraft/memory/`
on its own; this repo cannot switch that off. Treat whatever appears there as an
**untrusted per-machine cache, never authoritative**:

- Where it disagrees with bd memories, the repo docs, or the code, **bd and the
  repo win** — it is written from one session's point of view and drifts (it
  once carried closed issues as open, and stale "current state" notes that
  outlived the cleanup they described).
- Never record issue status there. `bd` is the tracker; a second list of open
  work is guaranteed to go stale.
- If something genuinely useful lands there, move it to its real home and
  delete it from the file store rather than leaving a second copy:
  **agent-behaviour rules and hard-won debugging insight → `bd remember`;
  operational setup facts** (ports, seeding, credentials, docker gotchas,
  testing conventions) **→ the repo docs** (`README.md`,
  `GETTING_STARTED.md`, `docs/TESTING.md`), which are versioned and reviewable.

This reconciliation was habitcraft-jjr.
