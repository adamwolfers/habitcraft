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
| `land.sh` | Merges a reviewed run, waits for CI, closes its beads, syncs the clone |
| `bd-failures.jq` | Finds failed `bd` calls in a pass transcript; `ralph.sh` logs them |
| `status.sh` | The queue, review and stuck beads, and recent passes, at a glance |

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

A `-p` session ends the moment the agent replies without a tool call, so a
pass that backgrounds a long command and says it will "pick up later" just
dies mid-bead (habitcraft-9e00). The prompt forbids that, and the scheduling
tools (`ScheduleWakeup`, `Monitor`, `CronCreate`) are disallowed outright. If
a pass dies anyway with work in the tree, finish it in place with
`claude -p --resume <session_id> "..."`; the id is in the `init` event at
the top of its `.ralph/pass-*.jsonl`.

## Reviewing

```bash
bd list --label agent-review     # what landed
bd list --label agent-stuck      # what needs you
cat .ralph/summary.log           # one line per pass
git log master..HEAD             # the commits
```

Every pass's full transcript is `.ralph/pass-*.jsonl`. Read the failures:
each new way the loop goes wrong is a fix to `PROMPT.md` or a missing test.

### Watching a run

```bash
scripts/ralph/status.sh            # one snapshot
scripts/ralph/status.sh --watch    # redraw every 15s (--watch 5 for 5s); Ctrl-C stops
```

It reads the clone (or `RALPH_CLONE`) and shows whether `ralph.sh` is running,
the review branch and how far it is ahead of master, then the loop's beads:
**Working** (the `agent-ok` bead a pass has claimed), **Queued**, **Review**
and **Stuck**, and the last lines of `summary.log`, counting any WARNs. It
makes one `bd` call per refresh. Tests: `scripts/ralph/status.test.sh`.

mg cannot show this: it has no label filter or label display (0.32.1 and
0.33.0), so queued beads look like every other ready bead (habitcraft-3oxu).
It does show a claimed bead moving to Rolling as a pass picks it up.

### Watching from mg

`mg` started in the clone shows the loop's beads live, since it reads the
same database the passes write. It also refreshes on its own, so it may
contend with a pass for that embedded database (habitcraft-82by). After each
pass `ralph.sh` runs `bd-failures.jq` over the transcript and logs any `bd`
call that hit a lock or printed an `Error:` line:

```
WARN: pass 2: 1 bd call(s) failed -- contention with mg? see pass-....jsonl
  bd update habitcraft-aaa --claim => Error: database is locked
```

No WARN means no `bd` call failed. If they appear only while mg is open,
close mg during runs. Tests: `scripts/ralph/bd-failures.test.sh`.

## Landing a run

After reviewing the branch, land it from the **main checkout** in one command:

```bash
cd ~/github/habitcraft
scripts/ralph/land.sh ralph/<date>
```

`land.sh` (habitcraft-tjwp):

1. refuses unless the main checkout is a clean `master`, the clone is clean,
   and `ralph.sh` is not running;
2. fetches the branch from the clone, rebases it onto master, fast-forwards,
   and pushes (the clone itself cannot push);
3. waits for the CI run on the pushed commit, reading its conclusion with
   `gh run view --json` and retrying through transient `gh` errors;
4. on green, closes every `agent-review` bead a merged commit names, with the
   commit and run id, and drops the label. On anything else it closes nothing;
5. either way, syncs the clone: `bd dolt pull`, back to `master`, branch
   deleted. That keeps `mg` running in the clone, and the next run, current.

It reports, rather than closes, an `agent-review` bead that no merged commit
names, and a bead a commit names that is not under review. If every file the
branch touches is paths-ignored, CI never starts; `land.sh` says so and leaves
the beads for you to close.

Its tests build throwaway repos with stub `gh`/`bd`, so they touch nothing
real. They are not in CI, since `scripts/ralph/` is paths-ignored there:

```bash
scripts/ralph/land.test.sh
```

## Beads sync between the two copies

Both copies push issue data to the same Dolt remote, and neither the
`pre-push` hook nor `scripts/beads-push.sh` pulls first. So after the loop has
pushed, **your main checkout's next beads push is rejected as
non-fast-forward, and `pre-push` then blocks your `git push`**. Run
`bd dolt pull` in the main checkout first. `ralph.sh` does that for itself
around every pass. The hook-side fix is habitcraft-lw6u.
