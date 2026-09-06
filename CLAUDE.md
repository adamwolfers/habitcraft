## General Notes

- Verify that you're in the expected branch and directory before running terminal commands
- `scripts/test-all.sh` runs every gate CI runs — lint, typecheck, and unit
  tests for backend/frontend/mobile, plus integration and E2E — sequentially, in
  the same order (cheap static checks first, docker phases last). A green run
  there predicts a green CI run. Lint/typecheck failures stop the run before
  containers start; pass `--keep-going` to run everything anyway. See
  [docs/TESTING.md](docs/TESTING.md) for the phase table.
- After each round of updates, and before committing those changes, check all project docs to see if they need updating
- See [AGENTS.md](AGENTS.md) for beads issue tracking workflow and session completion checklist

## Git Workflow: Trunk-Based Development

This project uses **trunk-based development**. The trunk is `master` (not `main`).

- Work directly in `/Users/afw/github/habitcraft` on `master`.
- Commit straight to `master` in small, focused increments (see Development Principles).
- **Do NOT create feature branches or git worktrees** for routine work. Committing on `master` is expected here — the general "branch before committing on the default branch" default does **not** apply to this repo.
- Pull before you push (`git pull --rebase`) and push frequently to keep the trunk current.
- Use a short-lived branch **only** when a change genuinely needs an isolated PR/CI run, and merge it back to `master` quickly.

```bash
# Normal flow: commit and push on master
git add <files> && git commit -m "..."
git pull --rebase
git push
```

## Git Hooks

**`.husky/` is the only hooks directory.** Git honours exactly one, and husky
claims it via `core.hooksPath=.husky/_`. That means **`.git/hooks/` is bypassed
entirely** — files there look installed but never run. The same applies to
`.beads/hooks/`.

**Do not run `bd hooks install`.** It was tested (habitcraft-8t8) and does not
work here: it points `core.hooksPath` at an absolute `.beads/hooks` path, yet
4 of 5 hooks still never fire — beads vendors husky's `_/h` dispatcher, which
expects hooks one level *above* the hooks dir, an assumption that breaks when
beads installs them *into* it. It also folds `.husky/pre-commit` inline while
its own managed block calls `bd hooks run pre-commit`, so beads runs twice per
commit. Note `bd hooks list` reports `✓ installed` throughout all of this —
it does not consult `core.hooksPath`, so never trust it as evidence.

`.husky/_/` holds generated stubs and is gitignored — it is recreated by the
`prepare` script on `npm install`. **A fresh clone has no working hooks until
you install dependencies.** Add real hooks as `.husky/<hook-name>`, and do not
source `_/h` inside them; the stub already does that.

| Hook | What it does |
|---|---|
| `pre-commit` | `bd hooks run pre-commit`, then each package's lint-staged |
| `pre-push` | `bd dolt push` — **blocks the push if it fails** (see below) |
| `post-merge`, `post-checkout`, `prepare-commit-msg` | beads sync via `bd hooks run <name>` |

Beads issue data lives in the gitignored `.beads/embeddeddolt/`, so it reaches
the Dolt remote only via `bd dolt push`. The `pre-push` hook does that
automatically and **fails the `git push` if the beads push fails** — a partial
push would leave issue state on one machine. Escape hatch: `git push
--no-verify`. Cost is roughly 3s per push (12s cold); bd does no work-avoidance
when there is nothing new to send.

Debug a hook with `HUSKY=2 git <command>`, which traces the dispatcher.

### Claude Code hooks (beads-only sessions)

`pre-push` only fires when there **is** a git push. A session that only touches
issues — closing beads, commenting, triage — produces no commits, so nothing
triggered it and the issue data stayed on one machine (habitcraft-clj). Two
hooks in `.claude/settings.json` close that, both running
`scripts/beads-push.sh`:

| Hook | What it does |
|---|---|
| `SessionEnd` | pushes on clean exit — `exit`, Ctrl-D, `/clear` |
| `SessionStart` | reports a prior failure, then pushes whatever an unclean exit stranded |

Use `SessionEnd`, **not `Stop`** — `Stop` fires once per *assistant turn*, which
would run a ~3s push after every response.

`SessionEnd` cannot block: its output and exit code are discarded, so a failure
there is invisible. That is why the script logs to `.beads/push.log`
(gitignored via `*.log`) — one `ok` line when healthy, appended `FAILED` blocks
otherwise, truncated on the next success. So **a log with any bulk in it means
something needs attention**. The `SessionStart` run prints that log back, which
is how a failed push surfaces at all.

Each hook passes its name as `$1`, and the script adds the `reason` (SessionEnd),
`source` (SessionStart) and short `session_id` that Claude Code puts on its
stdin, so every entry says what triggered it and which session it came from —
they share one log file:

```
2026-08-07T09:39:48-07:00 [SessionStart source=startup sid=7b79d806] ok
```

`.beads/push-history.log` is the **append-only** companion (capped at 200 lines,
also gitignored). `push.log` alone cannot answer *"did the hook actually fire?"*
— it truncates on success, and a `/clear` fires `SessionEnd` then `SessionStart`
seconds later, so the second write erases the first. The history log is the only
place that evidence survives, and answering that question is what habitcraft-8t8
could not do for the git hooks.

The stdin guard is `[ ! -t 0 ] && [ -r /dev/stdin ]`, and **both halves are
load-bearing** — each was established by a bug:

- `[ ! -t 0 ]` alone **hangs**: it is also false when fd 0 is *closed*, and `cat`
  then blocks forever, stalling session start until the 130s hook timeout.
- Testing the fd *type* (`-p` pipe / `-f` regular file) is **too strict** and
  silently drops the capture: a real `SessionStart` logged `[SessionStart]` with
  no `source=`, because the live hook's stdin is neither. Every synthetic pipe
  test passed and hid this — only a real session exposed it. **Test hook changes
  against a real invocation, not just a piped one.**

Neither hook covers an unclean death (crash, closed window, `kill -9`) that is
never followed by another session on that machine; `pre-push` catches those on
the next commit.

## Development Principles

1. **Security First** - Never compromise on authentication and authorization
2. **Test-Driven Development** - Write unit tests before implementation.  Target >90% coverage.
3. **Small, Focused Commits** - Commit after each passing test or feature
4. **Documentation** - Update docs alongside features
5. **User Experience** - Smooth, responsive UI with proper error handling
6. **Code Quality** - Clean, readable, modular, maintainable code


## Running tests with npm test

Use `npm test -- <pattern>` to run specific tests. Do NOT use `--testPathPattern` flag - it's deprecated:

```bash
# Correct
npm test -- Header.test.tsx

# Wrong - deprecated flag
npm test -- --testPathPattern="Header.test.tsx"
```

**Gotcha:** `npm test -- <pattern>` may run more test files than expected if the pattern is broad. To verify you're running only the intended tests, use jest directly:

```bash
# Run a specific test file in isolation (backend)
cd backend && npx jest routes/users.test.js --no-coverage

# Check test count matches expectations before trusting "all passed"
```

This is especially important during TDD - if you expect tests to fail but see "all passed", the tests may not be running.

## Testing Patterns

### Extract Logic to Utility Functions

**Problem:** React component logic using closures (e.g., `habits.find()` inside an event handler) captures state at render time. This makes branches hard to test because:
- Mocking the hook doesn't update the closure
- The UI only passes valid IDs from the same data
- Edge cases (like "item not found") can't occur through normal interaction

**Solution:** Extract the logic to a pure utility function that can be tested in isolation.

**Before (hard to test):**
```tsx
// page.tsx
const handleEditHabit = (habitId: string) => {
  const habit = habits.find((h) => h.id === habitId);  // Closure captures habits
  if (!habit) {
    console.error(`Habit not found: ${habitId}`);
    return;
  }
  setEditingHabit(habit);
};
```

**After (testable):**
```tsx
// utils/habitUtils.ts
export function findHabitById(habits: Habit[], habitId: string): Habit | undefined {
  return habits.find((h) => h.id === habitId);
}

// page.tsx
import { findHabitById } from "@/utils/habitUtils";

const handleEditHabit = (habitId: string) => {
  const habit = findHabitById(habits, habitId);  // Now mockable
  if (!habit) {
    console.error(`Habit not found: ${habitId}`);
    return;
  }
  setEditingHabit(habit);
};
```

**Testing the utility (trivial):**
```tsx
// utils/habitUtils.test.ts
describe("findHabitById", () => {
  it("returns undefined when habit is not found", () => {
    expect(findHabitById([mockHabit], "bad-id")).toBeUndefined();
  });
});
```

**Testing the component branch (now possible):**
```tsx
// page.test.tsx
jest.mock("@/utils/habitUtils", () => ({
  findHabitById: jest.fn(),
}));

it("logs error when habit not found", async () => {
  mockFindHabitById.mockReturnValue(undefined);  // Force the edge case
  // ... click edit button
  expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("not found"));
});
```

**When to apply this pattern:**
- Defensive code branches that can't be triggered through UI
- Logic that depends on component state captured in closures
- Any pure logic that would benefit from isolated unit tests


## Database Migrations

We use [dbmate](https://github.com/amacneil/dbmate) for database migrations. Migrations are pure SQL files in `db/migrations/`.

### Quick Commands

```bash
# Create a new migration
dbmate new add_feature_name

# Run migrations (local, non-Docker)
DATABASE_URL="postgresql://habituser:habitpass@localhost:5432/habitcraft?sslmode=disable" dbmate up

# Check status
DATABASE_URL="..." dbmate status
```

### Local Development

Migrations run automatically via Docker Compose. Just run:
```bash
docker compose up -d
```

### Creating Migrations

1. `dbmate new migration_name` - creates timestamped file
2. Add SQL to `-- migrate:up` section
3. Leave `-- migrate:down` as comment (forward-only strategy)
4. Test: `docker compose down -v && docker compose up -d`
5. Regenerate the committed schema dump: `./scripts/schema-dump.sh`

`db/migrations/` is the **only** source of truth for the schema, and the only
migrations directory. `db/schema.sql` is a generated `pg_dump` of those
migrations, committed so schema changes are reviewable as a diff — nothing
executes it and it must never be hand-edited. `scripts/schema-dump.sh --check`
regenerates and diffs it; it runs as the `verify-schema-dump` CI job and as a
phase of `scripts/test-all.sh`, so a migration without a regenerated dump turns
CI red. See [db/README.md](db/README.md#the-generated-schema-dump-dbschemasql).

### Forward-Only Strategy

We don't rollback migrations. If something breaks, fix forward with a new migration. See `db/README.md` for rationale.

## The API Contract

`shared/api-spec/openapi.yaml` is the **only** source of truth for the HTTP
interface, and the same generate-and-verify shape as `db/schema.sql` applies to
it. Three gates make it load-bearing:

| Gate | Question | CI job |
|---|---|---|
| Response validation | Does the server return what the spec says? | backend integration suite |
| Consumer codegen | Do the clients read the spec's shapes and limits? | `verify-api-codegen` |
| Breaking-change diff | Is this change safe for a deployed client? | `verify-openapi-breaking` |

After changing the spec:

```bash
npm run api:codegen            # regenerate; commit the result
npm run api:codegen -- --check # what CI runs
npm run api:breaking           # fails on a change that breaks a deployed client
```

`<consumer>/types/api.generated.ts` and `apiLimits.generated.ts` are generated
into `frontend/` and `mobile/` and **must never be hand-edited** — the same rule
as `db/schema.sql`. Do not write a validation limit as a literal in a component;
import it from the generated limits (habitcraft-467). `shared/types/models.ts`
is a superseded hand-written mirror that nothing imports — do not add to it.

See [shared/api-spec/README.md](shared/api-spec/README.md).


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
