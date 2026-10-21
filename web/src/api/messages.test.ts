import { describe, expect, it } from 'vitest';
import { messageFor } from './messages.ts';

describe('messageFor', () => {
  it("lists the server's validation errors", () => {
    const body = { errors: [{ msg: 'Invalid email format' }, { msg: 'Name is required' }] };
    expect(messageFor(400, body)).toBe(
      'Some details are not valid: Invalid email format; Name is required.'
    );
  });

  it("uses a habits route's message", () => {
    const body = { error: 'Validation error', message: 'name must not be blank', statusCode: 400 };
    expect(messageFor(400, body)).toBe('name must not be blank');
  });

  it('says so plainly when a refusal carries nothing to show', () => {
    expect(messageFor(404, { error: 'User not found' })).toBe(
      'That was not accepted. Check the details and try again.'
    );
  });

  it('asks the user to wait after too many attempts', () => {
    expect(messageFor(429, { message: 'Too many login attempts' })).toBe(
      'Too many attempts. Wait a few minutes and try again.'
    );
  });

  it('blames neither the user nor the details for a server fault or no answer', () => {
    expect(messageFor(500, { error: 'Internal server error' })).toBe(
      'Something went wrong. Try again in a moment.'
    );
    expect(messageFor(undefined, undefined)).toBe('Something went wrong. Try again in a moment.');
  });
});
