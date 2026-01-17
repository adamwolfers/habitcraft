# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync --no-pull     # Sync beads (safe - won't overwrite local changes)
```

## Important: Beads Sync Safety

**Always commit your code changes BEFORE running `bd sync`.**

`bd sync` does a `git pull` which can overwrite uncommitted changes. Safe pattern:
```bash
git add <files> && git commit -m "..."   # Commit your changes FIRST
git push                                  # Push your changes
bd sync --no-pull                         # Then sync beads (--no-pull is safer)
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git add <files> && git commit -m "..."  # Commit changes FIRST
   git push                                 # Push code changes
   bd sync --no-pull                        # Sync beads (after push!)
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

