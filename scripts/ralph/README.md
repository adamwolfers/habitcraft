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
| `lib.sh` | Shared helpers: `ralph_pids`, the one test for "is a loop running?" |

## Runbook

The whole cycle, start to finish. Each step links to its section below.
Everything that changes between runs lives in beads (labels, comments) and
`.ralph/summary.log`, not here (habitcraft-9r24).

1. **Pick a batch** and label it `agent-ok` from the main checkout
   ([choosing beads](#choosing-beads)). Five or six beads made a ~30-minute
   run in practice.
2. **Sync the clone:** `cd ~/github/habitcraft-ralph && git switch master &&
   git pull --rebase && bd dolt pull`. `land.sh` leaves it this way, so after
   a landing this is a no-op.
3. **Check the docker test stack** is the clone's or down
   ([docker](#the-docker-test-stack-is-machine-wide)). Ask before stopping
   one this session did not start.
4. **Start the run in tmux** so it outlives the terminal and the agent
   session that started it ([tmux](#run-it-in-tmux)):
   `git switch -c ralph/$(date +%F) && scripts/ralph/ralph.sh -n <batch size>`.
5. **Watch** with `status.sh --watch` and mg ([watching](#watching-a-run)).
   A WARN line or a stop in `summary.log` is what needs you.
6. **Review the branch by reading the diffs**, not the commit subjects
   ([checklist](#review-checklist)).
7. **Land it** from the main checkout with `scripts/ralph/land.sh
   ralph/<date>` ([landing](#landing-a-run)). It pushes, waits for CI, closes
   the beads and syncs the clone.
8. **Fold the lessons back in.** Each new way a pass went wrong becomes a line
   in `PROMPT.md` or a check in `ralph.sh`. Give it a bead labelled
   `loop-infra` and do it interactively, not in the loop. Beads the passes
   filed are follow-ups for the next batch.

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

### Choosing beads

A good `agent-ok` bead is self-contained, says what "done" means, and needs
no decision the bead doesn't already recommend. `test-all.sh` has to be able
to prove it. Its description should name files and lines, as the beads that
went well did.

Leave these out. Each was considered and rejected, or went wrong:

- **Production, secrets, store accounts, physical devices, the Detox suite.**
  A pass cannot reach them.
- **A decision the bead leaves open.** For example "decide whether X should
  gate" (uze), or "wire it or drop it" (sf50). A pass marks these stuck.
- **Flaky-test fixes** (oft7). One pass cannot show a flake is gone.
- **Production images, or a deploy-only check** (ara). `test-all.sh` does not
  build or boot the production image.
- **Changes to `scripts/ralph/`, `.claude/` or `.husky/`** (lw6u). The prompt
  forbids them, so a pass would mark them stuck. These beads carry the label
  **`loop-infra`**: never label one `agent-ok`. Work them in an interactive
  session. A pass that edited `PROMPT.md` or `ralph.sh` would change the
  passes after it, unreviewed and mid-run. A broken hook breaks every commit
  and push, including the loop's own beads sync. And CI never tests
  `scripts/ralph/`, so only the local suites stand guard
  (`bd list --label loop-infra`).
- **Large epics.** Split them first. One pass is one bead.

**Beads go stale.** In the second run, two of six (psq1 and g0p) had already
been satisfied by earlier work. The prompt now stops a pass at "already done"
and leaves the bead for you. A quick check of a bead's "done" condition before
you label it saves a pass.

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

### The docker test stack is machine-wide

`docker-compose.test.yml` pins container names and host ports (5433, 3010,
3110), so the loop's `test-all.sh` and one in your main checkout cannot run at
the same time. Before a run, see whose stack is up:

```bash
docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' habitcraft-db-test
```

The clone's stack is fine: the loop reuses it. If the stack belongs to the main
checkout, it may be another session mid-run. Long uptime does not mean idle
(`concurrent-test-stack-runs`). **Ask before stopping it.** Before the first
run, the orchestrating agent stopped that stack without asking, which that
memory says not to do.

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

### Run it in tmux

A loop started in a plain terminal dies with that window, and one started
from an agent's background shell dies with the agent's session. Inside tmux it
survives both. `Ctrl-b d` detaches, and `tmux attach -t ralph` comes back:

```bash
cd ~/github/habitcraft-ralph
tmux new-session -s ralph \; \
  send-keys 'scripts/ralph/status.sh --watch' C-m \; \
  split-window -h \; send-keys 'mg' C-m \; \
  split-window -v
```

Then type the run command into the third pane yourself. Text sent with
`send-keys` before zsh finishes starting is silently dropped. That happened to
the run command in the first tmux layout. An agent starting the run should
`tmux capture-pane -p -t ralph:0.2` first to see the pane is at a prompt, then
`tmux send-keys -t ralph:0.2 '<command>' C-m`.

Do not press mg's `a` (agent dispatch) in the clone while a run is going. It
starts a separate coding agent on the selected bead, outside the loop.

### Pass settings

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

### Review checklist

A summary built from commit subjects and the run log is not a review. Read
the diffs (`git show <sha>` in the clone). These caught or cleared real
things in the first two runs:

- **Did the pass do what the bead asked, and only that?** Watch for a stale
  bead turned into new scope. A pass may also mark a bead `RALPH ALREADY DONE`
  with no commit. Then you decide whether to close it or re-scope it.
- **Anything CI runs differently from `test-all.sh`?** Database setup is one
  case: CI resets the test DB with direct SQL, and a local run uses the docker
  script. Timeouts and new CI steps are others. These are where a locally green
  pass goes red after landing.
- **`ci.yml` edits:** comments under an `if: |` become part of the expression
  (`ci-yml-if-block-scalar`). Re-run that memory's check.
- **New paths:** `npm run verify:ci-filters` must pass. A path that matches no
  CI filter gets a green run that ran nothing.
- **Generated files** (`*.generated.*`, `db/schema.sql`) are never edited by
  hand.
- **Every commit has a body** saying why. One commit in the first run did not.
- **Each pass's hand-off comment.** It lists what the pass wants a human to
  check, and the follow-up beads it filed.

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
names, and a bead a commit names that is not under review. The first is what a
pass leaves when it finds its bead already done: no commit, and a
`RALPH ALREADY DONE` comment with the evidence. Close or re-scope those by
hand. If every file the branch touches is paths-ignored, CI never starts;
`land.sh` says so and leaves the beads for you to close.

Its tests build throwaway repos with stub `gh`/`bd`, so they touch nothing
real. They are not in CI, since `scripts/ralph/` is paths-ignored there:

```bash
scripts/ralph/land.test.sh
```

## Changing these scripts

`scripts/ralph/` is paths-ignored in CI, so nothing there is tested unless you
run the suites. Run all four after any change. They need only bash, git and
jq, with stubs for `gh` and `bd`:

```bash
for t in scripts/ralph/*.test.sh; do "$t" </dev/null | tail -1; done
```

macOS ships bash 3.2 as `/bin/bash`, which has no associative arrays. Inside a
`while read` loop, give every `bd` call `</dev/null`, or it can swallow the
loop's input. A detector, such as `bd-failures.jq` or the `ralph_pids`
pattern, needs a test proving it *finds* the thing. A clean result from a
detector that cannot fire means nothing. Both of those detectors had bugs that
first showed up as false "all clear" results.

## Beads sync between the two copies

Both copies push issue data to the same Dolt remote. So once the loop has
pushed, the main checkout's next beads push is rejected as non-fast-forward.
Both push paths — the `pre-push` hook and `scripts/beads-push.sh` — go through
`scripts/beads-dolt-push.sh`, which handles that by running `bd dolt pull` and
pushing again (habitcraft-lw6u). The pull runs only after a rejection, so a
copy that is already current pays for one push and nothing more. `ralph.sh`
also pulls before every pass, so the loop sees label changes made here.

The pull fails only when **both copies changed the same issue** since they
last synced. Any two edits to one issue conflict, even identical ones, because
each also writes `updated_at`. bd then prints `merge conflicts in issues
require operator resolution; merge aborted and working set restored` and
changes nothing locally. `pre-push` blocks the `git push`, and a session
hook's push lands as `FAILED` in `.beads/push.log`. To avoid it, don't edit a
bead in the main checkout while the loop has it claimed.

### Resolving a beads merge conflict

bd cannot resolve this itself under the embedded backend. `bd vc merge
--strategy theirs` fails, because Dolt rolls the merge back before the
strategy applies, and `bd sql` is not supported in embedded mode. Use the
`dolt` CLI directly on the database files (habitcraft-41gw). Verified with
bd 1.2.2 and dolt 2.3.3: only the conflicting rows take the side you choose,
and every other edit from both copies survives.

A Dolt merge needs a committer identity. Set it once per machine:

```bash
dolt config --global --add user.name "Your Name"
dolt config --global --add user.email "you@example.com"
```

Then, in the copy whose pull failed, with no `bd` command running there:

```bash
bd dolt show                                # 'Database:' names the live one
cd .beads/embeddeddolt/habitcraft           # that name; ignore *-backup dirs
dolt fetch origin
dolt merge origin/main                      # CONFLICT (content): ... in issues
dolt conflicts cat .                        # base / ours / theirs, per row
dolt conflicts resolve --theirs .           # or --ours; see below
dolt add . && dolt commit -m "Resolve beads merge conflict"
cd -
bd show <id>                                # check the issue looks right
scripts/beads-push.sh manual                # or just git push
```

`--theirs` keeps the remote's version of each conflicting issue, and
`--ours` keeps this copy's. The choice covers the **whole row**, so the
losing side's edits to that issue are dropped, including fields that did not
themselves conflict. Read them off `dolt conflicts cat` first. In the main
checkout, the remote's side is usually the loop's work. Take `--theirs` and
then redo your own edit with `bd update`. That gives one clean change on top
and keeps the loop's history.

Changed your mind partway through? `dolt merge --abort` puts the database
back exactly as it was before `dolt merge`.
