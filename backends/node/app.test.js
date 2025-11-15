const request = require('supertest');
const app = require('./app');

describe('GET /hello', () => {
  it('should return hello world message', async () => {
    const response = await request(app)
      .get('/hello')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({
      message: 'Hello World!'
    });
  });
});
