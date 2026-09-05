/**
 * OpenAPI spec loader and operation matcher.
 *
 * shared/api-spec/openapi.yaml is the API contract. This module makes it
 * MACHINE-READABLE so the integration suite can hold responses to it
 * (habitcraft-34d.2); before this existed, the spec had zero code references
 * and drifted freely.
 *
 * Two jobs:
 *   1. Turn OpenAPI 3.0 schemas into schemas ajv can compile (resolve $ref,
 *      translate `nullable`).
 *   2. Given a live request's method and URL path, find the operation that
 *      documents it.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const SPEC_PATH = path.join(__dirname, '..', '..', 'shared', 'api-spec', 'openapi.yaml');

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch', 'head', 'options', 'trace'];

let cachedSpec = null;

/**
 * Load and parse the OpenAPI document (cached per process).
 * @returns {object} The parsed spec
 */
function loadSpec() {
  if (!cachedSpec) {
    cachedSpec = yaml.load(fs.readFileSync(SPEC_PATH, 'utf8'));
  }
  return cachedSpec;
}

/**
 * Follow a local JSON pointer ('#/components/schemas/Habit') in the document.
 * @param {object} doc Root document
 * @param {string} ref The $ref value
 * @returns {*} The referenced node
 */
function resolvePointer(doc, ref) {
  if (!ref.startsWith('#/')) {
    throw new Error(`Only local $refs are supported, got: ${ref}`);
  }
  return ref
    .slice(2)
    .split('/')
    .reduce((node, segment) => {
      const key = segment.replace(/~1/g, '/').replace(/~0/g, '~');
      if (node === undefined || node === null || !(key in node)) {
        throw new Error(`Unresolvable $ref: ${ref}`);
      }
      return node[key];
    }, doc);
}

/**
 * Inline every $ref and translate OpenAPI 3.0's `nullable` into a JSON Schema
 * union type, which is what ajv actually understands.
 *
 * `nullable` is the trap here: ajv does not know the keyword, and in
 * non-strict mode it IGNORES it silently rather than erroring -- so a nullable
 * field left untranslated would reject every null the API legitimately
 * returns, and the failure would look like an API bug rather than a config
 * one.
 *
 * The spec has no circular $refs (Habit embeds Completion, nothing points
 * back), so a plain recursive inline terminates.
 *
 * @param {*} node Schema node
 * @param {object} doc Root document
 * @returns {*} A JSON-Schema-shaped copy
 */
function toJsonSchema(node, doc) {
  if (Array.isArray(node)) {
    return node.map((item) => toJsonSchema(item, doc));
  }
  if (node === null || typeof node !== 'object') {
    return node;
  }

  if (typeof node.$ref === 'string') {
    return toJsonSchema(resolvePointer(doc, node.$ref), doc);
  }

  const out = {};
  for (const [key, value] of Object.entries(node)) {
    // `example`/`examples` are OpenAPI annotations. Dropping them keeps ajv's
    // strict mode quiet and keeps compiled schemas small.
    if (key === 'example' || key === 'examples' || key === 'nullable') {
      continue;
    }
    out[key] = toJsonSchema(value, doc);
  }

  if (node.nullable === true) {
    if (typeof out.type === 'string') {
      out.type = [out.type, 'null'];
    } else if (Array.isArray(out.type) && !out.type.includes('null')) {
      out.type = [...out.type, 'null'];
    }
    if (Array.isArray(out.enum) && !out.enum.includes(null)) {
      out.enum = [...out.enum, null];
    }
  }

  return out;
}

/**
 * Turn a path template into an anchored regex.
 * '/api/v1/habits/{habitId}' -> /^\/api\/v1\/habits\/[^/]+$/
 * @param {string} template OpenAPI path template
 * @returns {RegExp} Matcher for a concrete request path
 */
function templateToRegExp(template) {
  const pattern = template
    .split(/(\{[^}]+\})/)
    .map((part) =>
      /^\{[^}]+\}$/.test(part) ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    .join('');
  return new RegExp(`^${pattern}$`);
}

let cachedOperations = null;

/**
 * Every documented operation, flattened.
 *
 * Sorted so that templates with fewer path parameters are tried first: a
 * literal path must win over a template that could also match it.
 *
 * @returns {Array<{method: string, template: string, regexp: RegExp,
 *   operationId: string, responses: object}>} Documented operations
 */
function getOperations() {
  if (cachedOperations) {
    return cachedOperations;
  }

  const doc = loadSpec();
  const operations = [];

  for (const [template, pathItem] of Object.entries(doc.paths)) {
    for (const method of HTTP_METHODS) {
      if (!pathItem[method]) {
        continue;
      }
      operations.push({
        method: method.toUpperCase(),
        template,
        regexp: templateToRegExp(template),
        operationId: pathItem[method].operationId || `${method} ${template}`,
        responses: pathItem[method].responses || {},
      });
    }
  }

  const paramCount = (template) => (template.match(/\{/g) || []).length;
  operations.sort((a, b) => paramCount(a.template) - paramCount(b.template));

  cachedOperations = operations;
  return operations;
}

/**
 * Find the operation documenting a live request.
 * @param {string} method HTTP method
 * @param {string} urlPath Request path, without query string
 * @returns {object|null} The operation, or null if undocumented
 */
function findOperation(method, urlPath) {
  const wanted = method.toUpperCase();
  return getOperations().find((op) => op.method === wanted && op.regexp.test(urlPath)) || null;
}

/**
 * True if any operation documents this path under a different method -- used
 * to tell "undocumented path" apart from "undocumented method on a known
 * path", which are different mistakes.
 * @param {string} urlPath Request path, without query string
 * @returns {boolean} Whether the path is documented at all
 */
function isDocumentedPath(urlPath) {
  return getOperations().some((op) => op.regexp.test(urlPath));
}

/**
 * The JSON response schema for one operation and status, ready for ajv.
 * @param {object} operation From findOperation()
 * @param {number|string} statusCode HTTP status
 * @returns {{documented: boolean, schema: object|null}} documented=false when
 *   the status is absent from the spec; schema=null when the status is
 *   documented as having no body (204).
 */
function getResponseSchema(operation, statusCode) {
  const doc = loadSpec();
  const entry = operation.responses[String(statusCode)] || operation.responses.default;

  if (!entry) {
    return { documented: false, schema: null };
  }

  const resolved = entry.$ref ? resolvePointer(doc, entry.$ref) : entry;
  const jsonContent = resolved.content && resolved.content['application/json'];

  if (!jsonContent || !jsonContent.schema) {
    return { documented: true, schema: null };
  }

  return { documented: true, schema: toJsonSchema(jsonContent.schema, doc) };
}

module.exports = {
  SPEC_PATH,
  loadSpec,
  getOperations,
  findOperation,
  isDocumentedPath,
  getResponseSchema,
  toJsonSchema,
  templateToRegExp,
};
