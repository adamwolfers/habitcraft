const request = require('supertest');
const app = require('../app');
const { closePool } = require('../db/pool');

describe('Security Headers (Helmet)', () => {
  afterAll(async () => {
    await closePool();
  });

  describe('X-Content-Type-Options', () => {
    it('should set X-Content-Type-Options to nosniff', async () => {
      const response = await request(app).get('/hello');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('X-Frame-Options', () => {
    it('should set X-Frame-Options to prevent clickjacking', async () => {
      const response = await request(app).get('/hello');

      // Helmet sets SAMEORIGIN by default
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });

  describe('Strict-Transport-Security (HSTS)', () => {
    it('should set Strict-Transport-Security header', async () => {
      const response = await request(app).get('/hello');

      // Helmet sets max-age=15552000 (180 days) by default
      expect(response.headers['strict-transport-security']).toMatch(/max-age=/);
    });
  });

  describe('X-DNS-Prefetch-Control', () => {
    it('should set X-DNS-Prefetch-Control to off', async () => {
      const response = await request(app).get('/hello');

      expect(response.headers['x-dns-prefetch-control']).toBe('off');
    });
  });

  describe('X-Download-Options', () => {
    it('should set X-Download-Options to noopen', async () => {
      const response = await request(app).get('/hello');

      expect(response.headers['x-download-options']).toBe('noopen');
    });
  });

  describe('X-Permitted-Cross-Domain-Policies', () => {
    it('should set X-Permitted-Cross-Domain-Policies to none', async () => {
      const response = await request(app).get('/hello');

      expect(response.headers['x-permitted-cross-domain-policies']).toBe('none');
    });
  });

  describe('Referrer-Policy', () => {
    it('should set Referrer-Policy header', async () => {
      const response = await request(app).get('/hello');

      // Helmet sets no-referrer by default
      expect(response.headers['referrer-policy']).toBe('no-referrer');
    });
  });

  describe('X-Powered-By', () => {
    it('should remove X-Powered-By header', async () => {
      const response = await request(app).get('/hello');

      // Helmet removes this header to hide Express
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('Content-Security-Policy', () => {
    it('should set Content-Security-Policy header', async () => {
      const response = await request(app).get('/hello');

      expect(response.headers['content-security-policy']).toBeDefined();
    });

    it('should restrict default-src to self', async () => {
      const response = await request(app).get('/hello');

      expect(response.headers['content-security-policy']).toMatch(/default-src 'self'/);
    });
  });

  describe('Headers on all endpoints', () => {
    it('should set security headers on /health endpoint', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    });

    it('should set security headers on API endpoints', async () => {
      // This will return 401 without auth, but headers should still be set
      const response = await request(app).get('/api/v1/habits');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });
});
