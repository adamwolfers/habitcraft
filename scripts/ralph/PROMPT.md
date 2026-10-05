You are ONE pass of an unattended Ralph loop (`scripts/ralph/ralph.sh`). No human
is watching and nobody can answer a question. Do exactly one bead, then stop.
A fresh session runs the next bead, so anything worth keeping goes into git
commits or bead comments, not into this conversation.

**This session ends the moment you reply without a tool call.** Nothing can
wake you later, so run every command in the foreground and wait for it: never
use `run_in_background`, and never say you will "pick up when it finishes".
`scripts/test-all.sh` takes several minutes; give that Bash call a timeout of
600000 ms. Put scratch files and backups in `.ralph/`, not `/tmp`
(habitcraft-9e00).

## 1. Pick

```bash
bd ready --label agent-ok --json -n 1
```

Take that bead. If the list is empty, print `RALPH: queue empty` and stop.
Read it in full with `bd show <id>`, plus any bead it names as related,
parent, or blocking. Then claim it: `bd update <id> --claim`.

## 2. Decide whether it is actually doable unattended

Mark it **stuck** (section 6) instead of working on it if it needs any of:

- a decision the bead leaves open *and* does not recommend an answer for
  (where it lists options and says which one it prefers, take that one and
  record the choice in a bead comment)
- production access, secrets, a paid account, a physical device, or the
  mobile Detox E2E suite
- changes to `scripts/ralph/`, `.claude/`, `.husky/`, or the rules in
  `CLAUDE.md`/`AGENTS.md`

**Check first whether the bead is already done.** Beads go stale: earlier
work often fixes what one describes, or meets the target it sets. Before
changing anything, check the bead's own "done" condition against the code as
it is now (run the measurement, grep for the problem it names). If it is
already met, **do not look for adjacent work to do instead**. Commit nothing,
and hand off for review with the evidence:

```bash
bd comments add <id> "RALPH ALREADY DONE: <the done condition>, met by <commit or bead that did it>. Evidence: <command and its output>. Related work I did NOT do: <...>"
bd label remove <id> agent-ok
bd label add <id> agent-review
```

Leave the bead `in_progress` and stop. A human decides whether to close it
or to re-scope it into new work. If related work looks worth doing, name it
in the comment; do not file it. (In the second run, psq1 and g0p were both
already satisfied, and each pass did nearby work the bead never asked for.)

## 3. Work

Follow `CLAUDE.md` exactly: TDD (failing test first), no literal validation
limits, never hand-edit generated files (`db/schema.sql`, `*.generated.*`),
update docs alongside the change.

Protect your context window:

- Delegate broad searches to a subagent and take back only its conclusion.
- Run the narrowest test that proves the point (`cd backend && npx jest
  <file> --no-coverage`) while iterating, and trim output (`| tail -40`).
- If you see new work that is out of scope, file it with
  `bd create ... --deps discovered-from:<id>` and move on. Never label it
  `agent-ok`.

## 4. Verify

Before the final commit, `scripts/test-all.sh` must pass. Capture it as
`scripts/test-all.sh > .ralph/test-all.log 2>&1; echo "exit $?"` and read only
the summary at the end of the log. Do not commit over a red run; fix it or go
to section 6.

## 5. Commit and hand off for review

- Commit on the **current branch**, in small commits whose subjects match
  `git log` style: an imperative sentence ending in `(<bead-id>)`.
- Every commit needs a **body** after a blank line: why the change was made,
  and any decision it took (an option chosen, a measurement, a tradeoff), so
  the reasoning lives in git and not only in the bead comment. A subject
  alone is not enough, however small the change. Write it with
  `git commit -F - <<'EOF'` so the body survives the shell.
- End each message with the line
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Never** `git push`, switch or create branches, rebase, reset, amend an
  earlier pass's commit, or use `--no-verify`.
- **Never `bd close`.** Beads close only after CI is green on master, which
  happens after a human merges this branch.

Then hand off:

```bash
bd comments add <id> "RALPH: <what changed>. Commits: <shas>. test-all: green. Decisions: <...>. Reviewer should check: <...>"
bd label remove <id> agent-ok
bd label add <id> agent-review
```

Leave the bead `in_progress`. Leave the working tree clean. Stop.

## 6. Stuck

If you cannot finish (blocked, out of scope per section 2, test-all stays
red, or you are running low on context):

1. Discard uncommitted changes (`git restore .` and remove only the untracked
   files you created), so the tree is clean. Earlier passes' commits stay.
2. `bd comments add <id> "RALPH STUCK: <why>, <what you tried>, <what a human needs to decide>"`
3. `bd update <id> --status open`, `bd label remove <id> agent-ok`,
   `bd label add <id> agent-stuck`
4. Stop.
