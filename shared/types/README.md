# Shared Types

> **`models.ts` is not the source of truth and nothing imports it.**
>
> `shared/api-spec/openapi.yaml` is the contract, and each consumer's types are
> **generated** from it — see
> [shared/api-spec/README.md](../api-spec/README.md). Do not add types here, and
> do not treat what is here as authoritative.

## What this directory is

`models.ts` is a hand-written mirror of the OpenAPI spec, written before the
spec was enforced. A repo-wide search finds **zero** importers: no component, no
test, no build step reads it. That is precisely why it drifted unnoticed, and
why habitcraft-467 replaced the idea rather than repairing the file — an
unimported mirror of a contract is a confident wrong answer.

It is left in place pending its own removal (habitcraft-brj) so that deletion is
a separate reviewable change.

## Where to go instead

| What you want | Where it is |
|---|---|
| The wire types | `frontend/types/habit.ts`, `mobile/src/types/index.ts` — aliases over the generated tree |
| The generated tree | `<consumer>/types/api.generated.ts`, from `npm run api:codegen` |
| Validation limits (maxLength, minLength) | `<consumer>/types/apiLimits.generated.ts` |
| The contract itself | [`shared/api-spec/openapi.yaml`](../api-spec/openapi.yaml) |
| Column widths | `db/migrations/`, readable as [`db/schema.sql`](../../db/schema.sql) |

## Adding a type

Change `shared/api-spec/openapi.yaml` and the handler together, run
`npm run api:codegen` from the repo root, and commit the regenerated files. CI
fails if they are stale. Nothing needs to be added here.
