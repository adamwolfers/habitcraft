/**
 * Cross-checks the generated validation limits against the DATABASE.
 *
 * Every other layer now imports its limits from apiLimits.generated.js (or its
 * TypeScript twin), so those layers cannot drift -- the codegen --check gate
 * holds them to shared/api-spec/openapi.yaml. The database is the one link that
 * cannot be an import: a migration's VARCHAR width is a separate statement of
 * the same fact, written in SQL, and habitcraft-34d.3 asks for a test rather
 * than an import to keep it honest.
 *
 * A width that disagrees is a real bug in one direction or the other: narrower
 * than the spec means the server promises to accept input Postgres will reject
 * with a 500; wider means the column tolerates rows the spec says cannot exist.
 */

const fs = require('fs');
const path = require('path');

const { schemaLimits, requestLimits } = require('./apiLimits.generated');

const SCHEMA_PATH = path.join(__dirname, '..', '..', 'db', 'schema.sql');

/**
 * Parses `db/schema.sql` into { table: { column: width } } for every
 * `character varying(N)` column. The generated dump is pg_dump output, so the
 * shape is stable: one column per line inside a CREATE TABLE block.
 */
function parseVarcharWidths(sql) {
  const widths = {};
  let table = null;

  for (const line of sql.split('\n')) {
    const createTable = line.match(/^CREATE TABLE public\.(\w+) \($/);
    if (createTable) {
      table = createTable[1];
      widths[table] = {};
      continue;
    }
    if (table && line.startsWith(');')) {
      table = null;
      continue;
    }
    if (!table) continue;

    const column = line.match(/^\s+(\w+) character varying\((\d+)\)/);
    if (column) widths[table][column[1]] = Number(column[2]);
  }

  return widths;
}

// Each row: the DB column, and the limit the rest of the stack enforces for it.
const CHECKS = [
  {
    what: 'habit name',
    table: 'habits',
    column: 'name',
    limit: schemaLimits.HabitInput.name.maxLength,
  },
  {
    what: 'habit description',
    table: 'habits',
    column: 'description',
    limit: schemaLimits.HabitInput.description.maxLength,
  },
  {
    what: 'user name',
    table: 'users',
    column: 'name',
    limit: requestLimits.register.name.maxLength,
  },
  {
    what: 'user email',
    table: 'users',
    column: 'email',
    limit: requestLimits.register.email.maxLength,
  },
];

describe('parseVarcharWidths', () => {
  it('reads a width out of a CREATE TABLE block', () => {
    const sql = [
      'CREATE TABLE public.habits (',
      '    name character varying(100) NOT NULL',
      ');',
    ].join('\n');

    expect(parseVarcharWidths(sql)).toEqual({ habits: { name: 100 } });
  });

  it('does not carry columns across table boundaries', () => {
    const sql = [
      'CREATE TABLE public.habits (',
      '    name character varying(100) NOT NULL',
      ');',
      '',
      'CREATE TABLE public.users (',
      '    email character varying(255) NOT NULL',
      ');',
    ].join('\n');

    expect(parseVarcharWidths(sql)).toEqual({
      habits: { name: 100 },
      users: { email: 255 },
    });
  });

  it('ignores columns that are not varchar', () => {
    const sql = ['CREATE TABLE public.completions (', '    notes text', ');'].join('\n');

    expect(parseVarcharWidths(sql)).toEqual({ completions: {} });
  });
});

describe('generated limits against db/schema.sql', () => {
  const widths = parseVarcharWidths(fs.readFileSync(SCHEMA_PATH, 'utf8'));

  // Without this, a parser that silently matched nothing would leave every
  // check below comparing undefined to undefined and reporting success.
  it('found the tables the checks below rely on', () => {
    expect(Object.keys(widths)).toEqual(expect.arrayContaining(['habits', 'users']));
  });

  it.each(CHECKS)('$what: column width matches the spec limit', ({ table, column, limit }) => {
    expect(widths[table][column]).toBe(limit);
  });
});

describe('completion notes', () => {
  // notes is `text`, so Postgres enforces no length at all and the maxLength in
  // the spec is enforced solely by the backend validator. Asserted rather than
  // assumed: if a migration ever narrows the column, the limit acquires a
  // second home and belongs in CHECKS above instead.
  it('has no database width to cross-check', () => {
    const widths = parseVarcharWidths(fs.readFileSync(SCHEMA_PATH, 'utf8'));

    expect(widths.completions.notes).toBeUndefined();
    expect(requestLimits.createCompletion.notes.maxLength).toBe(500);
  });
});
