/**
 * Text a test case asks for by its length rather than by its words, for the
 * product's limits. The limit itself always comes from apiLimits.generated.ts,
 * never from a number written into a test.
 */

/** Exactly at the limit, or one character past it. */
export type Length = 'longest-allowed' | 'too-long';

/** Words the test wrote, or text the DSL makes up to a length. */
export type Text = string | { length: Length };

/** One more than the limit for 'too-long'; the limit itself otherwise. */
export function lengthFor(length: Length, maxLength: number): number {
  return length === 'too-long' ? maxLength + 1 : maxLength;
}

/**
 * Resolve to a string. Made-up text is the same every time for the same
 * length, so a test can name it again when it checks the result.
 */
export function resolveText(text: Text, maxLength: number): string {
  if (typeof text === 'string') return text;
  return 'x'.repeat(lengthFor(text.length, maxLength));
}

/** How a step names text in its failure message. */
export function describeText(text: Text): string {
  return typeof text === 'string' ? `"${text}"` : `a ${text.length} text`;
}
