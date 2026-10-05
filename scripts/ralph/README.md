# Ralph loop

Runs Claude Code unattended over a queue of beads, one bead per fresh
`claude -p` session, committing to a branch for a human to review and merge.
It is Geoffrey Huntley's [Ralph loop](https://ghuntley.com/loop/) with beads
as the work queue and `scripts/test-all.sh` as the backpressure
(habitcraft-w1hv).

| File | Role |
|---|---|
| `ralph.sh` | The loop: picks nothing itself, just runs passes and stops on no progress |
| `PROMPT.md` | What every pass is told: pick, work, verify, commit, hand off |

## Why a fresh process per pass

Each pass starts with an empty context window, so a long run cannot fill it
up or carry a bad idea from one bead into the next. State survives between
passes only in git commits and bead comments. Claude Code's `/loop` re-prompts
inside **one** conversation and relies on compaction, which is the opposite
trade, so it is not used here.

The `SessionStart` hook still runs on every pass, so each one starts with
`bd prime` (the workflow plus every `bd remember`) and the beads doctor
already loaded.

## The bead lifecycle

| Label | Meaning | Who sets it |
|---|---|---|
| `agent-ok` | Queued for the loop | You |
| `agent-review` | Done on the branch, bead left `in_progress` | The loop |
| `agent-stuck` | Gave up; the comment says what a human must decide | The loop |

The loop **never closes a bead and never pushes git**. A bead closes only
after CI is green on master (`close-beads-last-ci-green`), which cannot happen
until you merge the branch. Label changes and comments do reach the Dolt
remote straight away, through the `SessionEnd` hook.

A good `agent-ok` bead is self-contained, says what "done" means, and needs
no decision the bead doesn't already recommend. Anything touching production,
secrets, store accounts, a physical device, or the mobile Detox suite is not
a candidate.

## One-time setup: a separate clone

The loop must not share a working copy with you, so give it its own clone.
This is the sequence that was actually run for `~/github/habitcraft-ralph`:

```bash
git clone https://github.com/adamwolfers/habitcraft.git ~/github/habitcraft-ralph
cd ~/github/habitcraft-ralph
bd init --remote "git+https://github.com/adamwolfers/habitcraft.git"
git reset --hard origin/master    # bd init COMMITS its own agent files; drop them
git config --unset core.hooksPath # ...and points hooks at .beads/hooks (see CLAUDE.md)
for d in . backend frontend mobile; do (cd $d && npm ci); done   # restores .husky/_
git config remote.origin.pushurl "DISABLED--ralph-clone-never-pushes"
scripts/beads-doctor.sh           # must be green before the first run
```

`bd init --remote` does restore the full issue database, but it also commits
Codex/agent scaffolding and rewires `core.hooksPath`, which is the broken
setup CLAUDE.md warns about. The reset and unset undo both. The disabled push
URL makes "never push" a fact rather than an instruction; `bd dolt push` uses
the Dolt remote and is unaffected.

**The docker test stack is machine-wide.** `docker-compose.test.yml` pins
container names and host ports (5433, 3010, 3110), so the loop's
`test-all.sh` and one in your main checkout cannot run at the same time. Run
the loop while you are away from the repo.

## A run

```bash
cd ~/github/habitcraft-ralph
git switch master && git pull --rebase
git switch -c ralph/$(date +%F)
scripts/ralph/ralph.sh -n 5
```

`ralph.sh` refuses to start on `master` or with a dirty tree. It stops when
no `agent-ok` bead is ready, after `-n` passes, or after any pass that handed
off no bead, left the tree dirty, or switched branches. A pass that is killed
after claiming its bead leaves it `in_progress` and still `agent-ok`; the loop
stops on that rather than skipping past it, and you reset it with
`bd update <id> --status open`.

Passes run in Claude Code's `auto` permission mode; override with
`RALPH_PERMISSION_MODE`. Each pass is killed after `-t` seconds (default an
hour).

## Reviewing

```bash
bd list --label agent-review     # what landed
bd list --label agent-stuck      # what needs you
cat .ralph/summary.log           # one line per pass
git log master..HEAD             # the commits
```

Every pass's full transcript is `.ralph/pass-*.jsonl`. Read the failures:
each new way the loop goes wrong is a fix to `PROMPT.md` or a missing test.

To land the work, pull the branch into your main checkout (the clone cannot
push), rebase it onto master there, and push:

```bash
cd ~/github/habitcraft
git fetch ~/github/habitcraft-ralph ralph/<date>:ralph/<date>
git rebase master ralph/<date>
git switch master && git merge --ff-only ralph/<date> && git branch -d ralph/<date>
bd dolt pull && git push
```

Once CI is green, close each `agent-review` bead with the run ID, exactly as
for hand-written work, and drop the `agent-review` label.

## Beads sync between the two copies

Both copies push issue data to the same Dolt remote, and neither the
`pre-push` hook nor `scripts/beads-push.sh` pulls first. So after the loop has
pushed, **your main checkout's next beads push is rejected as
non-fast-forward, and `pre-push` then blocks your `git push`**. Run
`bd dolt pull` in the main checkout first. `ralph.sh` does that for itself
around every pass. The hook-side fix is habitcraft-lw6u.
