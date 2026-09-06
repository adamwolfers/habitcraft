#!/usr/bin/env node
'use strict';

/**
 * Generates each API consumer's types and validation limits from
 * shared/api-spec/openapi.yaml, or verifies the committed output still matches
 * that spec.
 *
 * Usage:
 *   node scripts/api-codegen.js            regenerate the files in place
 *   node scripts/api-codegen.js --check    fail (with a diff) if any is stale
 *
 * WHY (habitcraft-467)
 *
 * habitcraft-34d.2 made openapi.yaml load-bearing on the PROVIDER side: every
 * response the backend integration suite provokes is validated against it. The
 * CONSUMER side had no such link -- frontend and mobile hand-wrote the types
 * and the length limits the spec already states, so they drifted in one
 * direction only and nothing noticed. Mobile's habit-name input capped at 50
 * against a spec that had said 100 all along (habitcraft-34d.3).
 *
 * This is the other half: the spec generates what the clients consume, and CI
 * fails on drift. Same shape as db/migrations -> db/schema.sql: one source of
 * truth, a derived artifact committed so it is reviewable as a diff, and a
 * --check mode that re-derives and compares. See scripts/schema-dump.sh.
 *
 * WHY GENERATE INTO EACH CONSUMER, NOT INTO shared/
 *
 * A single shared artifact becomes a build-tree coupling point between three
 * components that otherwise share nothing. Generating per consumer couples them
 * to an INTERFACE instead: each gets the slice it needs, in its own idiom, and
 * the duplication is fine because it is derived and CI-verified.
 *
 * shared/types/models.ts is the cautionary tale -- a hand-written mirror of the
 * spec that nothing in the repo imports, so nothing ever caught it drifting.
 * Generated output that nothing imports is the same corpse; every file below is
 * re-exported by the consumer's own types module, so a bad regeneration fails
 * that consumer's typecheck rather than sitting there looking authoritative.
 *
 * WHAT IS GENERATED
 *
 *   api.generated.ts        openapi-typescript's `paths`/`components` tree.
 *   apiLimits.generated.ts  the spec's minLength/maxLength values, which
 *                           openapi-typescript does NOT emit -- they are
 *                           validation keywords, not type information, so the
 *                           numbers a UI needs for `maxLength` would be lost.
 *
 * VERSION PINNING
 *
 * openapi-typescript's output changes between versions, so a moving range would
 * eventually turn CI red for no spec change at all -- the same hazard the pinned
 * image digests in scripts/schema-dump.sh exist for. It is pinned EXACTLY in the
 * root package.json (as picomatch already is). Bump it and regenerate in one
 * commit.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
// v7 ships ESM-first; the CJS build puts the generator on `.default`.
const { default: openapiTS, astToString } = require('openapi-typescript');

const PROJECT_ROOT = path.join(__dirname, '..');
const SPEC_PATH = path.join(PROJECT_ROOT, 'shared/api-spec/openapi.yaml');

// Where each consumer's generated files land. Both sit beside that consumer's
// hand-written types module, which re-exports them.
const CONSUMERS = [
  { name: 'frontend', dir: path.join(PROJECT_ROOT, 'frontend/types') },
  { name: 'mobile', dir: path.join(PROJECT_ROOT, 'mobile/src/types') },
];

const TYPES_FILE = 'api.generated.ts';
const LIMITS_FILE = 'apiLimits.generated.ts';

// Every JSON Schema keyword this extracts. Deliberately only the length
// constraints: they are the ones a client restates (a TextInput maxLength, a
// character counter) and therefore the ones that drift. Types, formats and
// enums already come through api.generated.ts.
const LIMIT_KEYWORDS = ['minLength', 'maxLength'];

const JSON_CONTENT_TYPE = 'application/json';
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options'];

const BANNER = (spec) => `/**
 * GENERATED FILE -- DO NOT EDIT.
 *
 * Derived from shared/api-spec/openapi.yaml (version ${spec.info.version}) by
 * scripts/api-codegen.js. Change the spec and regenerate:
 *
 *   npm run api:codegen
 *
 * CI fails if this file does not match what the spec produces.
 */
`;

/**
 * Collects the length constraints on one schema's own properties.
 * Returns null when the schema declares none, so empty entries stay out of the
 * generated file rather than filling it with noise.
 */
function extractLimits(schema) {
  if (!schema || typeof schema !== 'object' || !schema.properties) return null;

  const limits = {};
  for (const [property, definition] of Object.entries(schema.properties)) {
    if (!definition || typeof definition !== 'object') continue;

    const found = {};
    for (const keyword of LIMIT_KEYWORDS) {
      if (typeof definition[keyword] === 'number') found[keyword] = definition[keyword];
    }
    if (Object.keys(found).length > 0) limits[property] = found;
  }

  return Object.keys(limits).length > 0 ? limits : null;
}

/**
 * Limits keyed by component schema name, e.g. schemaLimits.HabitInput.name.
 */
function collectSchemaLimits(spec) {
  const collected = {};
  const schemas = (spec.components && spec.components.schemas) || {};

  for (const [name, schema] of Object.entries(schemas)) {
    const limits = extractLimits(schema);
    if (limits) collected[name] = limits;
  }
  return collected;
}

/**
 * Limits keyed by operationId, for the inline request bodies that are not
 * $refs to a component. Keyed by operation rather than by field name on
 * purpose: `name` is 100 on both a habit and a user today, and merging them by
 * name would silently couple two limits that are only coincidentally equal.
 */
function collectRequestLimits(spec) {
  const collected = {};

  for (const operations of Object.values(spec.paths || {})) {
    for (const method of HTTP_METHODS) {
      const operation = operations[method];
      if (!operation || !operation.operationId) continue;

      const body = operation.requestBody;
      const schema =
        body && body.content && body.content[JSON_CONTENT_TYPE]
          ? body.content[JSON_CONTENT_TYPE].schema
          : null;

      const limits = extractLimits(schema);
      if (limits) collected[operation.operationId] = limits;
    }
  }
  return collected;
}

/**
 * Renders a plain object as a TypeScript literal. Only ever fed the numbers and
 * identifier-safe keys collected above, so no escaping is needed -- but the key
 * check below makes that an assertion rather than an assumption.
 */
function renderObject(value, indent = '  ') {
  const entries = Object.entries(value).map(([key, inner]) => {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
      throw new Error(`Cannot render key as a TS identifier: ${key}`);
    }
    const rendered =
      typeof inner === 'number' ? String(inner) : renderObject(inner, `${indent}  `);
    return `${indent}${key}: ${rendered},`;
  });
  return `{\n${entries.join('\n')}\n${indent.slice(2)}}`;
}

function renderLimitsFile(spec) {
  const schemaLimits = collectSchemaLimits(spec);
  const requestLimits = collectRequestLimits(spec);

  // A spec walk that silently found nothing would otherwise be written out as a
  // legitimately empty file, and in --check mode an empty file matching an
  // empty file reports success -- the same trap schema-dump.sh guards with its
  // CREATE TABLE check.
  if (Object.keys(schemaLimits).length === 0 || Object.keys(requestLimits).length === 0) {
    throw new Error(
      'Extracted no limits from the spec -- refusing to write an empty file. ' +
        'Either openapi.yaml lost its minLength/maxLength keywords or this walk is broken.'
    );
  }

  return `${BANNER(spec)}
/**
 * Length constraints declared on the components/schemas entries, keyed by
 * schema name: \`schemaLimits.HabitInput.name.maxLength\`.
 *
 * Use these for the UI limits on a body a client SENDS -- the *Input schemas
 * are the request shapes. The response schemas (Habit, Completion) carry the
 * same numbers because they describe the same stored column.
 */
export const schemaLimits = ${renderObject(schemaLimits)} as const;

/**
 * Length constraints on inline request bodies that are not $refs to a
 * component, keyed by operationId: \`requestLimits.createCompletion.notes\`.
 */
export const requestLimits = ${renderObject(requestLimits)} as const;
`;
}

async function renderTypesFile(spec) {
  const ast = await openapiTS(new URL(`file://${SPEC_PATH}`));
  return `${BANNER(spec)}\n${astToString(ast)}`;
}

/**
 * Returns a unified diff of two strings, or '' when they are identical.
 */
function diff(expectedLabel, expected, actualLabel, actual) {
  if (expected === actual) return '';

  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const lines = [`--- ${expectedLabel}`, `+++ ${actualLabel}`];

  for (let i = 0; i < Math.max(expectedLines.length, actualLines.length); i++) {
    if (expectedLines[i] === actualLines[i]) continue;
    if (expectedLines[i] !== undefined) lines.push(`-${i + 1}: ${expectedLines[i]}`);
    if (actualLines[i] !== undefined) lines.push(`+${i + 1}: ${actualLines[i]}`);
  }
  return lines.join('\n');
}

async function main() {
  const mode = process.argv[2];
  if (mode !== undefined && mode !== '--check') {
    console.error(`Unknown parameter: ${mode}`);
    process.exit(1);
  }
  const checkMode = mode === '--check';

  const spec = yaml.load(fs.readFileSync(SPEC_PATH, 'utf8'));

  const generated = {
    [TYPES_FILE]: await renderTypesFile(spec),
    [LIMITS_FILE]: renderLimitsFile(spec),
  };

  // Guard against openapi-typescript producing a file that parses but says
  // nothing -- see the empty-limits note above.
  if (!generated[TYPES_FILE].includes('export interface components')) {
    console.error(
      `❌ The generated ${TYPES_FILE} has no \`components\` interface -- refusing to use it.`
    );
    process.exit(1);
  }

  const stale = [];
  for (const consumer of CONSUMERS) {
    for (const [file, contents] of Object.entries(generated)) {
      const target = path.join(consumer.dir, file);
      const relative = path.relative(PROJECT_ROOT, target);

      if (!checkMode) {
        fs.writeFileSync(target, contents);
        console.log(`✅ Wrote ${relative}`);
        continue;
      }

      if (!fs.existsSync(target)) {
        stale.push({ relative, reason: 'missing', detail: '' });
        continue;
      }
      const committed = fs.readFileSync(target, 'utf8');
      const delta = diff(`committed ${relative}`, committed, 'generated from openapi.yaml', contents);
      if (delta) stale.push({ relative, reason: 'out of date', detail: delta });
    }
  }

  if (!checkMode) return;

  if (stale.length === 0) {
    console.log('✅ Generated API artifacts match shared/api-spec/openapi.yaml');
    return;
  }

  console.error('');
  console.error('❌ Generated API artifacts do not match shared/api-spec/openapi.yaml.');
  console.error('   openapi.yaml is the source of truth; these files are generated.');
  console.error('   Regenerate and commit them:  npm run api:codegen');
  for (const entry of stale) {
    console.error('');
    console.error(`--- ${entry.relative} (${entry.reason})`);
    if (entry.detail) console.error(entry.detail);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
