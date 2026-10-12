/**
 * Layer 3: the contract every protocol driver implements.
 *
 * It speaks in user actions and observations, with concrete values the DSL has
 * already made unique. It never mentions HTTP, URLs, selectors or ids, so the
 * API driver, the web driver and later the native-app drivers are
 * interchangeable under the same test cases.
 *
 * An action the product may legitimately refuse returns an Outcome instead of
 * throwing, so a test can ask for the refusal. Each driver translates its own
 * channel's signal (a status code, an error message on screen) into the same
 * Refusal. Anything else going wrong still throws.
 */

export interface Account {
  email: string;
  password: string;
  name: string;
}

export type Credentials = Pick<Account, 'email' | 'password'>;

/** A calendar date as YYYY-MM-DD, already resolved by the DSL. */
export type IsoDate = string;

/** Why the product said no, in the user's terms. */
export type Refusal =
  | 'invalid-input'
  | 'email-taken'
  | 'invalid-credentials'
  | 'wrong-password'
  | 'already-checked-off'
  | 'signed-out';

export type Outcome = { ok: true } | { ok: false; refusal: Refusal };

export interface Profile {
  name: string;
  email: string;
}

export interface ProtocolDriver {
  // --- account and session ------------------------------------------------

  /** Create an account and, on success, act as that user from now on. */
  register(account: Account): Promise<Outcome>;

  /** Sign in and, on success, act as that user from now on. */
  signIn(credentials: Credentials): Promise<Outcome>;

  signOut(): Promise<void>;

  /**
   * Keep the session going past the short-lived access credential, as a
   * client does when it has been open a while. Refused with 'signed-out' when
   * the session can no longer be renewed.
   */
  renewSession(): Promise<Outcome>;

  /** Whether the acting user can still reach their own data. */
  isSignedIn(): Promise<boolean>;

  // --- profile --------------------------------------------------------------

  profile(): Promise<Profile>;

  updateProfile(changes: Partial<Profile>): Promise<Outcome>;

  changePassword(currentPassword: string, newPassword: string): Promise<Outcome>;

  /** Delete the acting user's account, confirming with their password. */
  deleteAccount(password: string): Promise<Outcome>;

  // --- habits ---------------------------------------------------------------

  createHabit(name: string): Promise<Outcome>;

  renameHabit(name: string, newName: string): Promise<Outcome>;

  archiveHabit(name: string): Promise<void>;

  restoreHabit(name: string): Promise<void>;

  deleteHabit(name: string): Promise<void>;

  /** Names of the acting user's active habits. */
  habitNames(): Promise<string[]>;

  /** Names of the acting user's archived habits. */
  archivedHabitNames(): Promise<string[]>;

  // --- completions ----------------------------------------------------------

  checkOff(habitName: string, date: IsoDate, note?: string): Promise<Outcome>;

  uncheck(habitName: string, date: IsoDate): Promise<void>;

  /** Set or, with null, clear the note on a checked-off day. */
  setNote(habitName: string, date: IsoDate, note: string | null): Promise<void>;

  isCheckedOff(habitName: string, date: IsoDate): Promise<boolean>;

  /** The note on a checked-off day; null when there is none. */
  noteOn(habitName: string, date: IsoDate): Promise<string | null>;

  /** Release anything the driver holds: sessions, browsers, sockets. */
  close(): Promise<void>;
}
