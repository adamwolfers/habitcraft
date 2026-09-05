/**
 * Captures every response the test HTTP server sends and hands it to the
 * OpenAPI response validator.
 *
 * Patches writeHead/write/end at the raw http level rather than res.json in
 * express. That is deliberate: it also catches the responses express itself
 * produces (a malformed JSON body, an unmatched route), which are exactly the
 * ones no route file documents and no reviewer thinks to check.
 */

const { checkResponse } = require('./responseValidator');

/**
 * Coerce whatever was handed to write()/end() into a Buffer.
 * @param {*} chunk The chunk
 * @param {*} encoding Optional encoding argument
 * @returns {Buffer|null} The chunk as bytes, or null if there was none
 */
function toBuffer(chunk, encoding) {
  if (chunk === null || chunk === undefined || typeof chunk === 'function') {
    return null;
  }
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }
  return Buffer.from(chunk, typeof encoding === 'string' ? encoding : 'utf8');
}

/**
 * Pull a content-type out of whatever writeHead() was handed.
 *
 * Headers passed to writeHead() are written straight to the socket and are
 * NOT visible to getHeader() afterwards -- a documented Node behaviour and an
 * easy trap, since express sets its own headers via setHeader() and so looks
 * fine right up until something calls writeHead() directly.
 * @param {*} headers The headers argument, if there was one
 * @returns {string|null} The content-type, or null if absent
 */
function contentTypeFrom(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    return null;
  }
  const key = Object.keys(headers).find((name) => name.toLowerCase() === 'content-type');
  return key ? String(headers[key]) : null;
}

/**
 * Start recording one request/response pair.
 * @param {import('http').IncomingMessage} req Inbound request
 * @param {import('http').ServerResponse} res Outbound response
 * @returns {void}
 */
function interceptResponse(req, res) {
  // Snapshot the URL NOW. Express rewrites req.url as it routes into mounted
  // routers -- by the time 'finish' fires, a request to /api/v1/auth/login
  // reads as '/login' -- so reading it later matches nothing in the spec.
  const urlPath = req.url.split('?')[0];
  const chunks = [];
  let writeHeadContentType = null;
  const originalWriteHead = res.writeHead;
  const originalWrite = res.write;
  const originalEnd = res.end;

  res.writeHead = function patchedWriteHead(statusCode, reasonOrHeaders, maybeHeaders) {
    writeHeadContentType =
      contentTypeFrom(maybeHeaders) || contentTypeFrom(reasonOrHeaders) || writeHeadContentType;
    return originalWriteHead.call(this, statusCode, reasonOrHeaders, maybeHeaders);
  };

  res.write = function patchedWrite(chunk, encoding, callback) {
    const buffered = toBuffer(chunk, encoding);
    if (buffered) {
      chunks.push(buffered);
    }
    return originalWrite.call(this, chunk, encoding, callback);
  };

  res.end = function patchedEnd(chunk, encoding, callback) {
    const buffered = toBuffer(chunk, encoding);
    if (buffered) {
      chunks.push(buffered);
    }
    return originalEnd.call(this, chunk, encoding, callback);
  };

  res.on('finish', () => {
    const raw = Buffer.concat(chunks);
    const contentType = String(writeHeadContentType || res.getHeader('content-type') || '');
    const isJson = contentType.includes('application/json');

    let body;
    let parsed = isJson;
    if (isJson && raw.length > 0) {
      try {
        body = JSON.parse(raw.toString('utf8'));
      } catch {
        parsed = false;
      }
    } else if (isJson) {
      // JSON content-type with no bytes is not JSON either.
      parsed = false;
    } else {
      body = raw.toString('utf8');
    }

    checkResponse({
      method: req.method,
      urlPath,
      statusCode: res.statusCode,
      isJson: parsed,
      hasBody: raw.length > 0,
      body,
    });
  });
}

module.exports = { interceptResponse };
