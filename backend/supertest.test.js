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

const request = require('supertest');

describe('supertest', () => {
  it('binds its server to loopback, not to every interface', async () => {
    const response = await request((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ boundTo: req.socket.server.address().address }));
    }).get('/');

    expect(response.body.boundTo).toBe('127.0.0.1');
  });
});
