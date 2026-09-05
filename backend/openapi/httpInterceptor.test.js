/**
 * Unit tests for the raw-http response interceptor.
 *
 * Driven through a real http server rather than a mocked res: the details that
 * matter here (that 'finish' fires, that chunks written in pieces reassemble,
 * that express has already rewritten req.url by then) only exist on a genuine
 * ServerResponse.
 */

const http = require('http');

describe('openapi/httpInterceptor', () => {
  let server;
  let checkResponse;
  let interceptResponse;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('./responseValidator', () => ({ checkResponse: jest.fn() }));
    ({ checkResponse } = require('./responseValidator'));
    ({ interceptResponse } = require('./httpInterceptor'));
  });

  afterEach(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      server = null;
    }
    jest.dontMock('./responseValidator');
  });

  /**
   * Start a server that intercepts, then runs `handler`, and issue one request.
   * @param {Function} handler (req, res) written as the app would write it
   * @param {object} options Request options
   * @param {string} options.path Request path
   * @param {string} options.method Request method
   * @returns {Promise<{observed: object, delivered: string}>} What the
   *   interceptor reported, and what the client actually received
   */
  async function capture(handler, { path = '/hello', method = 'GET' } = {}) {
    server = http.createServer((req, res) => {
      interceptResponse(req, res);
      handler(req, res);
    });
    await new Promise((resolve) => server.listen(0, resolve));

    const delivered = await new Promise((resolve, reject) => {
      const request = http.request(
        { host: '127.0.0.1', port: server.address().port, path, method },
        (response) => {
          let received = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            received += chunk;
          });
          response.on('end', () => resolve(received));
        }
      );
      request.on('error', reject);
      request.end();
    });

    return { observed: checkResponse.mock.calls[0][0], delivered };
  }

  it('reports a JSON response with its body parsed', async () => {
    const { observed } = await capture((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ message: 'Hello World!' }));
    });

    expect(observed).toMatchObject({
      method: 'GET',
      urlPath: '/hello',
      statusCode: 200,
      isJson: true,
      hasBody: true,
      body: { message: 'Hello World!' },
    });
  });

  it('strips the query string from the path', async () => {
    const { observed } = await capture(
      (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      },
      { path: '/api/v1/habits?status=active' }
    );

    expect(observed.urlPath).toBe('/api/v1/habits');
  });

  it('records the URL as it arrived, not as the app later rewrote it', async () => {
    // Express strips the mount path off req.url as it routes into a sub-router.
    // Reading req.url in the 'finish' handler would therefore see '/login'
    // where the spec documents '/api/v1/auth/login', and match nothing.
    const { observed } = await capture(
      (req, res) => {
        req.url = '/login';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
      },
      { path: '/api/v1/auth/login', method: 'POST' }
    );

    expect(observed.urlPath).toBe('/api/v1/auth/login');
  });

  it('reassembles a body written in several chunks', async () => {
    const { observed } = await capture((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write('{"mess');
      res.write('age":"hi"}');
      res.end();
    });

    expect(observed.body).toEqual({ message: 'hi' });
  });

  it('reports a bodiless response as having no body', async () => {
    const { observed } = await capture((req, res) => {
      res.writeHead(204);
      res.end();
    });

    expect(observed).toMatchObject({ statusCode: 204, hasBody: false, isJson: false });
  });

  it('reports a non-JSON response as not JSON, with its text', async () => {
    const { observed } = await capture((req, res) => {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<html>Cannot GET</html>');
    });

    expect(observed).toMatchObject({ isJson: false, body: '<html>Cannot GET</html>' });
  });

  it('reports a JSON content-type with an unparseable body as not JSON', async () => {
    const { observed } = await capture((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{ this is not json');
    });

    expect(observed.isJson).toBe(false);
  });

  it('reports a JSON content-type with an empty body as not JSON', async () => {
    const { observed } = await capture((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end();
    });

    expect(observed).toMatchObject({ isJson: false, hasBody: false });
  });

  it('honours the encoding argument when a chunk is not a Buffer', async () => {
    const { observed } = await capture((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(Buffer.from('{"message":"hi"}').toString('base64'), 'base64');
    });

    expect(observed.body).toEqual({ message: 'hi' });
  });

  it('still delivers the response to the client', async () => {
    // The interceptor patches writeHead/write/end; a patch that forgot to call
    // through would hang or truncate every request in the suite.
    const { observed, delivered } = await capture((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.write('{"message":');
      res.end('"delivered"}');
    });

    expect(delivered).toBe('{"message":"delivered"}');
    expect(observed.body).toEqual({ message: 'delivered' });
  });

  it('reads a content-type set with setHeader, as express does', async () => {
    const { observed } = await capture((req, res) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.statusCode = 200;
      res.end('{"message":"hi"}');
    });

    expect(observed).toMatchObject({ isJson: true, body: { message: 'hi' } });
  });

  it('reads a content-type passed to writeHead, which getHeader cannot see', async () => {
    // Node writes writeHead() headers straight to the socket without caching
    // them, so res.getHeader('content-type') returns undefined here.
    const { observed } = await capture((req, res) => {
      res.writeHead(200, 'OK', { 'content-type': 'application/json' });
      res.end('{"message":"hi"}');
    });

    expect(observed).toMatchObject({ isJson: true, body: { message: 'hi' } });
  });
});
