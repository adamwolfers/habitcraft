# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync beads with remote
bd help sync          # See all sync options
```

## Git Worktree Setup

This project uses **git worktrees** for parallel development:

| Branch | Worktree Path |
|--------|---------------|
| `master` (main) | `/Users/afw/github/habitcraft` |
| feature branches | `/Users/afw/github/habitcraft-<branch-suffix>` |

Feature branch worktrees are **ephemeral** - they have no upstream remote and are merged locally to main.

**Merging feature branches to main:**
```bash
cd /Users/afw/github/habitcraft         # Go to main worktree (NOT checkout)
git merge <feature-branch-name>          # Merge the feature branch
git push                                  # Push main to remote
```

## Beads Sync Patterns

**For ephemeral feature branches** (no upstream), use `--from-main` to pull beads state from main:
```bash
bd sync --from-main    # One-way sync: pulls beads from main branch
```

**For branches with upstream**, use standard sync:
```bash
bd sync                # Full sync: pull, merge, commit, push
```

**Important:** Always commit code changes BEFORE running `bd sync` - it does a git pull.

## Landing the Plane (Session Completion)

**When ending a work session**, complete ALL steps. Work is NOT done until pushed to remote.

**For feature branch worktrees (no upstream):**
```bash
git add <files> && git commit -m "..."  # 1. Commit in feature branch
bd sync --from-main                      # 2. Sync beads from main
cd /Users/afw/github/habitcraft          # 3. Go to main worktree
git merge <feature-branch-name>          # 4. Merge feature branch
git push                                  # 5. Push main to remote
```

**For branches with upstream:**
```bash
git add <files> && git commit -m "..."  # 1. Commit changes
git push                                 # 2. Push code
bd sync                                  # 3. Sync beads
```

**CRITICAL RULES:**
- Work is NOT complete until changes are pushed to remote
- NEVER stop before pushing - that leaves work stranded locally
- If push fails, resolve and retry until it succeeds
