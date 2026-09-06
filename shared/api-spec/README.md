# The API contract

`openapi.yaml` is the single source of truth for the HTTP interface between the
backend and its two clients. It is not documentation that happens to describe
the API — three separate gates make it load-bearing, and each closes a different
failure.

| Gate | Question it answers | Where it lives |
|---|---|---|
| Response validation | Does the server actually return what the spec says? | `backend/openapi/`, run by the integration suite |
| Consumer codegen | Do the clients read the same shapes and limits the spec states? | `scripts/api-codegen.js`, job `verify-api-codegen` |
| Breaking-change diff | Is this spec change safe to ship to clients already deployed? | `scripts/openapi-breaking.sh`, job `verify-openapi-breaking` |

The first came from habitcraft-34d.2, the other two from habitcraft-467.

## Why three and not one

Response validation keeps the *provider* honest, but says nothing about the
clients: frontend and mobile hand-wrote the types and length limits the spec
already stated, so they drifted in one direction only and nothing noticed.
Mobile's habit-name input capped at 50 characters against a spec that had said
100 since the beginning — a user typing a 60-character name got no error, their
keystrokes simply stopped (habitcraft-34d.3).

Codegen closes that, but both gates together only keep the three components
*agreeing with each other*. They stay green when provider, consumers and
generated files all move in one commit — which is exactly what a breaking change
looks like. The app already on someone's phone cannot be updated in lockstep,
so the third gate asks whether the change is shippable at all.

## Generated artifacts

`npm run api:codegen` (from the repo root) regenerates, and
`npm run api:codegen -- --check` verifies:

```
frontend/types/api.generated.ts        openapi-typescript's paths/components tree
frontend/types/apiLimits.generated.ts  the spec's minLength/maxLength values
mobile/src/types/api.generated.ts
mobile/src/types/apiLimits.generated.ts
```

Two files rather than one because `openapi-typescript` does not emit
`minLength`/`maxLength`: they are validation keywords, not type information, so
the numbers a `<TextInput maxLength>` needs would be lost. The limits file is
walked out of the spec separately.

**Generated into each consumer, not into `shared/`.** A single shared artifact
becomes a build-tree coupling point between components that otherwise share
nothing; per-consumer generation couples them to an interface instead. The
duplication is fine because it is derived and CI-verified — the same reasoning
that makes a committed `db/schema.sql` acceptable.

Nothing imports the generated files directly. Each consumer's own types module
(`frontend/types/habit.ts`, `mobile/src/types/index.ts`) re-exports the aliases
its components use, so a bad regeneration fails that consumer's typecheck.
That indirection is the point: `shared/types/models.ts` is a hand-written mirror
of this spec that **nothing in the repo imports**, which is why nothing ever
caught it drifting. Generated output nobody reads would be the same corpse.

## Changing the spec

1. Change `openapi.yaml` and the handler together — response schemas describe
   what the handlers *actually* return (see `backend/openapi/README.md`).
2. Run `npm run api:codegen` from the repo root and commit the regenerated
   files. Never hand-edit them.
3. Run `npm run api:breaking` before pushing. It compares your working tree
   against `origin/master`; CI compares against the pull request's merge target.

Both checks also run as phases 7 and 8 of `scripts/test-all.sh`.

## Deliberate breaking changes

Prefer making the change additive (a new optional field, a new endpoint) or
versioning the operation so the old shape keeps working.

If a breaking change really is safe — no deployed client depends on the part
that changed — record the exception by committing
`shared/api-spec/oasdiff-severity.txt`, one `<rule-id> <level>` pair per line:

```
request-property-max-length-decreased info
```

The rule id is the one printed in brackets by the failing check. The file is
picked up automatically when present, so the exception is reviewed as a diff
rather than living as an invisible flag on a CI job.

**Note the granularity:** a downgrade applies to that rule everywhere in the
spec, not to the one operation that tripped it. Delete the entry once the
change has landed rather than letting it accumulate.

## Version pinning

`openapi-typescript` is pinned to an exact version in the root `package.json`,
and the oasdiff image is pinned by digest inside `scripts/openapi-breaking.sh`.
Both decide the outcome of a check that has no source change of its own, so a
moving version would eventually turn CI red on its own schedule — the same
reason `scripts/schema-dump.sh` pins its two images by digest. Bump either
deliberately, and regenerate in the same commit.
