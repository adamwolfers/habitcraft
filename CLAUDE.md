## General Notes

- Verify that you're in the expected branch and directory before running terminal commands
- All tests can be run sequentially using scripts/test-all.sh
- After each round of updates, and before committing those changes, check all project docs to see if they need updating
- See [AGENTS.md](AGENTS.md) for beads issue tracking workflow and session completion checklist

## Git Worktree Workflow

This project uses **git worktrees**. The main branch is `master` (not `main`).

| Location | Branch | Purpose |
|----------|--------|---------|
| `/Users/afw/github/habitcraft` | `master` | Main worktree - merges and pushes happen here |
| `/Users/afw/github/habitcraft-*` | feature branches | Ephemeral worktrees for development |

**CRITICAL: Never run `git checkout main` or `git checkout master` from a feature worktree.** This can create a divergent local branch. Instead, merge via the main worktree:

```bash
# From feature worktree: commit your changes
git add <files> && git commit -m "..."

# Go to main worktree to merge (don't checkout!)
cd /Users/afw/github/habitcraft
git merge <feature-branch-name>
git push
```

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
cd backends/node && npx jest routes/users.test.js --no-coverage

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

### Forward-Only Strategy

We don't rollback migrations. If something breaks, fix forward with a new migration. See `db/README.md` for rationale.


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
   bd dolt push
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
<!-- END BEADS INTEGRATION -->
