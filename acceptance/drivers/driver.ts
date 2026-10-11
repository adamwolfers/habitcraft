/**
 * Layer 3: the contract every protocol driver implements.
 *
 * It speaks in user actions and observations, with concrete values the DSL has
 * already made unique. It never mentions HTTP, URLs, selectors or ids, so the
 * API driver, the web driver and later the native-app drivers are
 * interchangeable under the same test cases.
 */

export interface Account {
  email: string;
  password: string;
  name: string;
}

/** A calendar date as YYYY-MM-DD, already resolved by the DSL. */
export type IsoDate = string;

export interface ProtocolDriver {
  /** Create an account and act as that user from now on. */
  register(account: Account): Promise<void>;

  /** Sign in to an existing account and act as that user from now on. */
  signIn(account: Pick<Account, 'email' | 'password'>): Promise<void>;

  createHabit(name: string): Promise<void>;

  checkOff(habitName: string, date: IsoDate): Promise<void>;

  /** Names of the acting user's active habits. */
  habitNames(): Promise<string[]>;

  isCheckedOff(habitName: string, date: IsoDate): Promise<boolean>;

  /** Release anything the driver holds: sessions, browsers, sockets. */
  close(): Promise<void>;
}
