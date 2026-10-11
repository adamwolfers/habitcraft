/**
 * Holds every response the API driver receives to shared/api-spec/openapi.yaml.
 *
 * The backend integration suite does the same from inside the Node process
 * (backend/openapi/). This copy checks from outside, over HTTP, so it holds the
 * Go server to the same contract without knowing which server it is talking to.
 * It is written fresh rather than imported, because backend/ is deleted at
 * cutover and this suite must outlive it.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Ajv, type ValidateFunction } from 'ajv';
import addFormatsModule from 'ajv-formats';
import yaml from 'js-yaml';

// ajv-formats is CommonJS; under NodeNext its callable sits on `.default`.
const addFormats = addFormatsModule as unknown as typeof addFormatsModule.default;

const DESCRIPTION_PATH = path.join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'shared',
  'api-spec',
  'openapi.yaml'
);

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const;

type Node = Record<string, unknown>;

interface Operation {
  method: string;
  template: string;
  matcher: RegExp;
  responses: Record<string, Node>;
}

const document = yaml.load(readFileSync(DESCRIPTION_PATH, 'utf8')) as Node;

function resolvePointer(ref: string): unknown {
  if (!ref.startsWith('#/')) throw new Error(`Only local $refs are supported, got: ${ref}`);
  return ref
    .slice(2)
    .split('/')
    .reduce<unknown>((node, segment) => {
      const key = segment.replace(/~1/g, '/').replace(/~0/g, '~');
      if (node === null || typeof node !== 'object' || !(key in node)) {
        throw new Error(`Unresolvable $ref: ${ref}`);
      }
      return (node as Node)[key];
    }, document);
}

/**
 * Inline every $ref and turn OpenAPI 3.0's `nullable` into a JSON Schema union.
 * ajv silently ignores `nullable`, so leaving it would reject every legal null.
 */
function toJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toJsonSchema);
  if (node === null || typeof node !== 'object') return node;

  const source = node as Node;
  if (typeof source.$ref === 'string') return toJsonSchema(resolvePointer(source.$ref));

  const out: Node = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === 'example' || key === 'examples' || key === 'nullable') continue;
    out[key] = toJsonSchema(value);
  }
  if (source.nullable === true) {
    if (typeof out.type === 'string') out.type = [out.type, 'null'];
    if (Array.isArray(out.enum) && !out.enum.includes(null)) out.enum = [...out.enum, null];
  }
  return out;
}

function templateToRegExp(template: string): RegExp {
  const pattern = template
    .split(/(\{[^}]+\})/)
    .map((part) => (part.startsWith('{') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${pattern}$`);
}

const operations: Operation[] = Object.entries(document.paths as Record<string, Node>).flatMap(
  ([template, item]) =>
    HTTP_METHODS.filter((method) => method in item).map((method) => ({
      method: method.toUpperCase(),
      template,
      matcher: templateToRegExp(template),
      responses: (item[method] as Node).responses as Record<string, Node>,
    }))
);

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const compiled = new Map<string, ValidateFunction>();

/**
 * Throw if a response is not what the API Description documents for this
 * request: an unknown path or method, an undocumented status, or a body that
 * does not match the schema.
 */
export function assertDocumentedResponse(
  method: string,
  urlPath: string,
  status: number,
  body: unknown
): void {
  const where = `${method} ${urlPath} -> ${status}`;
  const operation = operations.find((op) => op.method === method && op.matcher.test(urlPath));
  if (!operation) throw new Error(`${where}: not documented in openapi.yaml`);

  const documented = operation.responses[String(status)];
  if (!documented) {
    throw new Error(
      `${where}: status not documented for ${operation.method} ${operation.template} ` +
        `(documented: ${Object.keys(operation.responses).join(', ')})`
    );
  }

  const response = toJsonSchema(documented) as Node;
  const content = response.content as Record<string, { schema?: unknown }> | undefined;
  const schema = content?.['application/json']?.schema;
  if (!schema) {
    if (body !== undefined) throw new Error(`${where}: documented without a body, but got one`);
    return;
  }

  const key = `${operation.method} ${operation.template} ${status}`;
  let validate = compiled.get(key);
  if (!validate) {
    validate = ajv.compile(schema as object);
    compiled.set(key, validate);
  }
  if (!validate(body)) {
    const details = (validate.errors ?? [])
      .map((err) => `    ${err.instancePath || '(root)'} ${err.message}`)
      .join('\n');
    throw new Error(
      `${where}: response does not match openapi.yaml\n${details}\n    received: ${JSON.stringify(body)}`
    );
  }
}
