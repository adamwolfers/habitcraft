/**
 * What to tell the user when a request fails. Each form names the failures
 * it expects (a taken email, a wrong password); these cover the rest.
 */

interface ValidationErrors {
  errors: { msg: string }[];
}

interface WithMessage {
  message: string;
}

function isValidationErrors(body: unknown): body is ValidationErrors {
  return (
    typeof body === 'object' && body !== null && Array.isArray((body as ValidationErrors).errors)
  );
}

function hasMessage(body: unknown): body is WithMessage {
  return (
    typeof body === 'object' && body !== null && typeof (body as WithMessage).message === 'string'
  );
}

/** A request the server refused for what was sent: a 400, a 403 or a 404. */
export function refusedMessage(body: unknown): string {
  if (isValidationErrors(body)) {
    return `Some details are not valid: ${body.errors.map((error) => error.msg).join('; ')}.`;
  }
  if (hasMessage(body)) return body.message;
  return 'That was not accepted. Check the details and try again.';
}

/** Anything else: too many attempts, a server fault, no answer at all. */
export function failedMessage(status: number | undefined): string {
  if (status === 429) return 'Too many attempts. Wait a few minutes and try again.';
  return 'Something went wrong. Try again in a moment.';
}

/** The message for any failure no form names itself. */
export function messageFor(status: number | undefined, body: unknown): string {
  if (status !== undefined && status >= 400 && status < 500 && status !== 429) {
    return refusedMessage(body);
  }
  return failedMessage(status);
}
