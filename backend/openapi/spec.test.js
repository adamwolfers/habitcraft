/**
 * Unit tests for the OpenAPI spec loader and operation matcher.
 *
 * These run against the REAL shared/api-spec/openapi.yaml rather than a
 * fixture: the point of habitcraft-34d.2 is that the shipped spec is
 * machine-readable, and a fixture would let the shipped one rot again.
 */

const {
  loadSpec,
  getOperations,
  findOperation,
  isDocumentedPath,
  getResponseSchema,
  toJsonSchema,
  templateToRegExp,
} = require('./spec');

describe('loadSpec', () => {
  it('parses the shipped OpenAPI document', () => {
    const spec = loadSpec();

    expect(spec.openapi).toBe('3.0.3');
    expect(spec.paths).toBeDefined();
  });

  it('returns the same cached object on repeat calls', () => {
    expect(loadSpec()).toBe(loadSpec());
  });
});

describe('getOperations', () => {
  it('flattens every documented path and method', () => {
    const keys = getOperations().map((op) => `${op.method} ${op.template}`);

    expect(keys).toContain('GET /health');
    expect(keys).toContain('POST /api/v1/auth/login');
    expect(keys).toContain('DELETE /api/v1/users/me');
    expect(keys).toContain('PUT /api/v1/habits/{habitId}/completions/{date}');
  });

  it('orders literal paths ahead of templated ones', () => {
    const templates = getOperations().map((op) => op.template);
    const literal = templates.indexOf('/api/v1/habits');
    const templated = templates.indexOf('/api/v1/habits/{habitId}');

    expect(literal).toBeLessThan(templated);
  });

  it('returns the same cached array on repeat calls', () => {
    expect(getOperations()).toBe(getOperations());
  });
});

describe('templateToRegExp', () => {
  it('matches a concrete path against its template', () => {
    const regexp = templateToRegExp('/api/v1/habits/{habitId}/completions/{date}');

    expect(regexp.test('/api/v1/habits/abc-123/completions/2026-01-15')).toBe(true);
  });

  it('does not let a path parameter swallow a slash', () => {
    const regexp = templateToRegExp('/api/v1/habits/{habitId}');

    expect(regexp.test('/api/v1/habits/abc/completions')).toBe(false);
  });

  it('escapes regex metacharacters in literal segments', () => {
    const regexp = templateToRegExp('/a.b');

    expect(regexp.test('/a.b')).toBe(true);
    expect(regexp.test('/axb')).toBe(false);
  });
});

describe('findOperation', () => {
  it('matches a literal path', () => {
    expect(findOperation('GET', '/api/v1/habits').template).toBe('/api/v1/habits');
  });

  it('matches a templated path', () => {
    const operation = findOperation('DELETE', '/api/v1/habits/aaaa-bbbb');

    expect(operation.template).toBe('/api/v1/habits/{habitId}');
  });

  it('is case-insensitive about the method', () => {
    expect(findOperation('get', '/health').operationId).toBe('healthCheck');
  });

  it('returns null for an undocumented path', () => {
    expect(findOperation('GET', '/api/v1/nope')).toBeNull();
  });

  it('returns null for an undocumented method on a documented path', () => {
    expect(findOperation('PATCH', '/api/v1/habits')).toBeNull();
  });
});

describe('isDocumentedPath', () => {
  it('is true for a path documented under some method', () => {
    expect(isDocumentedPath('/api/v1/habits')).toBe(true);
  });

  it('is false for a path the spec never mentions', () => {
    expect(isDocumentedPath('/api/v1/nope')).toBe(false);
  });
});

describe('getResponseSchema', () => {
  it('inlines $refs into a self-contained schema', () => {
    const { documented, schema } = getResponseSchema(findOperation('GET', '/api/v1/users/me'), 200);

    expect(documented).toBe(true);
    expect(schema.properties.email.format).toBe('email');
    expect(JSON.stringify(schema)).not.toContain('$ref');
  });

  it('resolves a $ref that points at a shared response object', () => {
    const { schema } = getResponseSchema(findOperation('GET', '/api/v1/users/me'), 401);

    expect(schema.required).toEqual(['error']);
  });

  it('reports a status the spec does not document', () => {
    expect(getResponseSchema(findOperation('GET', '/api/v1/habits'), 418)).toEqual({
      documented: false,
      schema: null,
    });
  });

  it('reports a documented status that carries no body', () => {
    expect(getResponseSchema(findOperation('DELETE', '/api/v1/habits/x'), 204)).toEqual({
      documented: true,
      schema: null,
    });
  });

  it('keeps every response schema closed and fully required', () => {
    // The guarantee the whole mechanism rests on: a response schema that
    // omitted either of these would let drift through unnoticed.
    for (const operation of getOperations()) {
      for (const status of Object.keys(operation.responses)) {
        const { schema } = getResponseSchema(operation, status);
        if (!schema || schema.type === 'array') {
          continue;
        }
        expect([operation.operationId, status, schema.additionalProperties]).toEqual([
          operation.operationId,
          status,
          false,
        ]);
        expect(Object.keys(schema.properties).sort()).toEqual([...schema.required].sort());
      }
    }
  });
});

describe('toJsonSchema', () => {
  const doc = { components: { schemas: { Thing: { type: 'string' } } } };

  it('translates nullable into a union type ajv understands', () => {
    expect(toJsonSchema({ type: 'string', nullable: true }, doc)).toEqual({
      type: ['string', 'null'],
    });
  });

  it('appends null to an existing type array exactly once', () => {
    expect(toJsonSchema({ type: ['string', 'null'], nullable: true }, doc)).toEqual({
      type: ['string', 'null'],
    });
  });

  it('allows null in a nullable enum', () => {
    expect(toJsonSchema({ type: 'string', enum: ['a'], nullable: true }, doc)).toEqual({
      type: ['string', 'null'],
      enum: ['a', null],
    });
  });

  it('drops OpenAPI annotation keywords ajv has no use for', () => {
    expect(toJsonSchema({ type: 'string', example: 'x', examples: { a: 1 } }, doc)).toEqual({
      type: 'string',
    });
  });

  it('recurses into arrays', () => {
    expect(toJsonSchema([{ type: 'string', nullable: true }], doc)).toEqual([
      { type: ['string', 'null'] },
    ]);
  });

  it('passes primitives through untouched', () => {
    expect(toJsonSchema(null, doc)).toBeNull();
    expect(toJsonSchema(7, doc)).toBe(7);
  });

  it('rejects a non-local $ref rather than silently ignoring it', () => {
    expect(() => toJsonSchema({ $ref: 'other.yaml#/Thing' }, doc)).toThrow(/Only local \$refs/);
  });

  it('rejects a $ref that points at nothing', () => {
    expect(() => toJsonSchema({ $ref: '#/components/schemas/Missing' }, doc)).toThrow(
      /Unresolvable \$ref/
    );
  });

  it('decodes ~0 and ~1 escapes in a JSON pointer', () => {
    const escaped = { components: { 'a/b': { 'c~d': { type: 'number' } } } };

    expect(toJsonSchema({ $ref: '#/components/a~1b/c~0d' }, escaped)).toEqual({ type: 'number' });
  });
});
