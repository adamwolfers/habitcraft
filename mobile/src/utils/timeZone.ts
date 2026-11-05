/**
 * The device's IANA time zone, sent with each check-off so the server judges
 * "today" on the user's calendar rather than UTC's (habitcraft-vxln.19).
 * Undefined if the runtime cannot say, and the server then falls back to UTC.
 */
export const localTimeZone = (): string | undefined =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
