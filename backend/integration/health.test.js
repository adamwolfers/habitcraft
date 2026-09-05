/**
 * Health and Hello Integration Tests
 *
 * These endpoints are trivial, but they are part of the API contract and the
 * OpenAPI coverage check fails the run for any documented operation no
 * integration test exercises (habitcraft-34d.2). They are also the only two
 * endpoints served from the origin root rather than under /api/v1, which is
 * why the spec's paths are absolute.
 */

const request = require('supertest');
const { getTestServer } = require('./setup');

const testServer = getTestServer();

describe('Health Integration Tests', () => {
  describe('GET /health', () => {
    it('reports the service healthy with a live database connection', async () => {
      const response = await request(testServer).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        service: 'habittracker-api',
        version: expect.any(String),
        status: 'healthy',
        timestamp: expect.any(String),
        database: 'connected',
      });
      expect(new Date(response.body.timestamp).toString()).not.toBe('Invalid Date');
    });
  });

  describe('GET /hello', () => {
    it('returns the hello message', async () => {
      const response = await request(testServer).get('/hello');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Hello World!' });
    });
  });
});
