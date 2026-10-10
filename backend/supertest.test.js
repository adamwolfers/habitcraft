/**
 * Guards the supertest version against a flake that is invisible in its own
 * test file (habitcraft-oft7).
 *
 * supertest connects to 127.0.0.1. Before 7.3.1 it bound its throwaway server
 * with a bare listen(0), which is a wildcard bind. On macOS another process can
 * then bind 127.0.0.1 on that same port, and the more specific bind wins: the
 * request goes to that process instead of the app. In oft7, routes/auth.test.js
 * got a 401 whose body.error was an object. No handler here writes that shape.
 * Binding to 127.0.0.1 makes the other process's bind fail with EADDRINUSE.
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('./app');
const { JWT_SECRET } = require('./config/jwt');

jest.mock('./db/pool');
jest.mock('./utils/securityLogger');

describe('supertest', () => {
  it('binds its server to loopback, not to every interface', async () => {
    const response = await request((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ boundTo: req.socket.server.address().address }));
    }).get('/');

    expect(response.body.boundTo).toBe('127.0.0.1');
  });

  describe('when another server binds 127.0.0.1 on its port', () => {
    // Replays oft7 on demand rather than waiting for it. The next listen() is
    // supertest starting its server; as soon as that has a port, an impostor
    // tries to bind 127.0.0.1 on it and answers the way oft7's response looked.
    // supertest sends nothing until the test is awaited, so awaiting the
    // impostor's bind first takes the race out.
    //
    // On supertest 7.1.4 under macOS the impostor binds and answers this test.
    // Linux refuses that bind even for a wildcard server, so CI passes either way.
    const realListen = http.Server.prototype.listen;
    let impostor;
    let impostorBind;

    beforeEach(() => {
      impostor = http.createServer((req, res) => {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { type: 'impostor' } }));
      });

      jest.spyOn(http.Server.prototype, 'listen').mockImplementationOnce(function (...args) {
        const result = realListen.apply(this, args);
        impostorBind = new Promise((resolve) => {
          const bind = () => {
            impostor.once('error', (error) => resolve(error.code));
            impostor.once('listening', () => resolve('bound'));
            realListen.call(impostor, this.address().port, '127.0.0.1');
          };
          // A wildcard listen(0) has its port already; a hosted one binds later.
          if (this.address()) bind();
          else this.prependOnceListener('listening', bind);
        });
        return result;
      });
    });

    afterEach(async () => {
      jest.restoreAllMocks();
      if (impostor.listening) await new Promise((resolve) => impostor.close(resolve));
    });

    it('still delivers the request to the app', async () => {
      const refreshToken = jwt.sign({ userId: 'user-1', type: 'refresh' }, JWT_SECRET, {
        expiresIn: '-1s',
      });

      const pending = request(app).post('/api/v1/auth/refresh').send({ refreshToken });

      const bindResult = await impostorBind;
      const response = await pending;

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Refresh token expired');
      expect(bindResult).toBe('EADDRINUSE');
    });
  });
});
