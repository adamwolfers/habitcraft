/**
 * The API protocol driver: performs each user action as the HTTP calls a
 * client would make, against any server at `baseUrl`. It holds the acting
 * user's tokens and sends the access token as a bearer token, the way the
 * mobile client does, so it needs no cookie jar.
 *
 * Every response is checked against openapi.yaml before the driver looks at
 * it, so a scenario that passes has also proved the server kept the contract.
 */

import type {
  Account,
  Credentials,
  IsoDate,
  Outcome,
  Profile,
  ProtocolDriver,
  Refusal,
} from '../driver.ts';
import type { components } from './api.generated.ts';
import { assertDocumentedResponse } from './apiDescription.ts';

type Schemas = components['schemas'];
type HabitWithCompletions = Schemas['HabitWithCompletions'];
type HabitCompletions = Schemas['HabitCompletions'];

interface Response {
  status: number;
  body: unknown;
}

/** Which status means which refusal, for one operation. */
type Refusals = Partial<Record<number, Refusal>>;

const OK: Outcome = { ok: true };

export class ApiDriver implements ProtocolDriver {
  private accessToken: string | undefined;
  private refreshToken: string | undefined;

  constructor(private readonly baseUrl: string) {}

  // --- account and session --------------------------------------------------

  async register(account: Account): Promise<Outcome> {
    const response = await this.request('POST', '/auth/register', account);
    return this.signedIn(response, 201, { 400: 'invalid-input', 409: 'email-taken' });
  }

  async signIn({ email, password }: Credentials): Promise<Outcome> {
    const response = await this.request('POST', '/auth/login', { email, password });
    return this.signedIn(response, 200, { 400: 'invalid-input', 401: 'invalid-credentials' });
  }

  async signOut(): Promise<void> {
    // Logout reads the refresh token from its cookie only.
    const cookie = this.refreshToken ? `refreshToken=${this.refreshToken}` : undefined;
    expectStatus(await this.request('POST', '/auth/logout', undefined, { cookie }), 200);
    this.accessToken = undefined;
    this.refreshToken = undefined;
  }

  async renewSession(): Promise<Outcome> {
    const response = await this.request('POST', '/auth/refresh', {
      refreshToken: this.refreshToken,
    });
    const outcome = outcomeOf(response, 200, { 400: 'signed-out', 401: 'signed-out' });
    if (outcome.ok) this.keepTokens(response.body as Schemas['TokenPair']);
    return outcome;
  }

  async isSignedIn(): Promise<boolean> {
    const { status } = await this.request('GET', '/users/me');
    if (status === 200) return true;
    if (status === 401 || status === 404) return false;
    throw new Error(`GET /users/me: unexpected ${status}`);
  }

  // --- profile --------------------------------------------------------------

  async profile(): Promise<Profile> {
    const user = expectStatus<Schemas['User']>(await this.request('GET', '/users/me'), 200);
    return { name: user.name, email: user.email };
  }

  async updateProfile(changes: Partial<Profile>): Promise<Outcome> {
    const response = await this.request('PUT', '/users/me', changes);
    return outcomeOf(response, 200, { 400: 'invalid-input', 409: 'email-taken' });
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<Outcome> {
    const response = await this.request('PUT', '/users/me/password', {
      currentPassword,
      newPassword,
      confirmPassword: newPassword,
    });
    const outcome = outcomeOf(response, 200, { 400: 'invalid-input', 401: 'wrong-password' });
    // The change revokes every refresh token, this session's included, and
    // hands back a fresh pair to carry on with.
    if (outcome.ok) this.keepTokens(response.body as Schemas['PasswordChanged']);
    return outcome;
  }

  async deleteAccount(password: string): Promise<Outcome> {
    const response = await this.request('DELETE', '/users/me', { password });
    return outcomeOf(response, 204, { 400: 'invalid-input', 401: 'wrong-password' });
  }

  // --- habits ---------------------------------------------------------------

  async createHabit(name: string): Promise<Outcome> {
    const input: Schemas['HabitInput'] = { name };
    return outcomeOf(await this.request('POST', '/habits', input), 201, { 400: 'invalid-input' });
  }

  async renameHabit(name: string, newName: string): Promise<Outcome> {
    const habit = await this.habitNamed(name);
    const input: Schemas['HabitInput'] = { name: newName };
    const response = await this.request('PUT', `/habits/${habit.id}`, input);
    return outcomeOf(response, 200, { 400: 'invalid-input' });
  }

  async archiveHabit(name: string): Promise<void> {
    await this.setStatus(name, 'archived');
  }

  async restoreHabit(name: string): Promise<void> {
    await this.setStatus(name, 'active');
  }

  async deleteHabit(name: string): Promise<void> {
    const habit = await this.habitNamed(name);
    expectStatus(await this.request('DELETE', `/habits/${habit.id}`), 204);
  }

  async habitNames(): Promise<string[]> {
    return (await this.habits('active')).map((habit) => habit.name);
  }

  async archivedHabitNames(): Promise<string[]> {
    return (await this.habits('archived')).map((habit) => habit.name);
  }

  // --- completions ----------------------------------------------------------

  async checkOff(habitName: string, date: IsoDate, note?: string): Promise<Outcome> {
    const habit = await this.habitNamed(habitName);
    const response = await this.request('POST', `/habits/${habit.id}/completions`, {
      date,
      ...(note === undefined ? {} : { notes: note }),
    });
    return outcomeOf(response, 201, { 400: 'invalid-input', 409: 'already-checked-off' });
  }

  async uncheck(habitName: string, date: IsoDate): Promise<void> {
    const habit = await this.habitNamed(habitName);
    expectStatus(await this.request('DELETE', `/habits/${habit.id}/completions/${date}`), 200);
  }

  async setNote(habitName: string, date: IsoDate, note: string | null): Promise<Outcome> {
    const habit = await this.habitNamed(habitName);
    const response = await this.request('PUT', `/habits/${habit.id}/completions/${date}`, {
      notes: note,
    });
    return outcomeOf(response, 200, { 400: 'invalid-input' });
  }

  async isCheckedOff(habitName: string, date: IsoDate): Promise<boolean> {
    return (await this.completionOn(habitName, date)) !== undefined;
  }

  async noteOn(habitName: string, date: IsoDate): Promise<string | null> {
    const completion = await this.completionOn(habitName, date);
    if (!completion) throw new Error(`"${habitName}" is not checked off on ${date}`);
    return completion.notes;
  }

  async checkedOffDays(from: IsoDate, to: IsoDate): Promise<Record<string, IsoDate[]>> {
    const all = expectStatus<HabitWithCompletions[]>(await this.request('GET', '/habits'), 200);
    const names = new Map(all.map((habit) => [habit.id, habit.name]));
    const days: Record<string, IsoDate[]> = {};
    for (const { habitId, completions } of await this.completionsBetween(from, to)) {
      const name = names.get(habitId);
      if (name === undefined)
        throw new Error(`A period lists habit ${habitId}, which is not listed`);
      days[name] = completions.map((completion) => completion.date);
    }
    return days;
  }

  async close(): Promise<void> {
    this.accessToken = undefined;
    this.refreshToken = undefined;
  }

  // --- helpers --------------------------------------------------------------

  private signedIn(response: Response, expected: number, refusals: Refusals): Outcome {
    const outcome = outcomeOf(response, expected, refusals);
    if (outcome.ok) this.keepTokens(response.body as Schemas['AuthResponse']);
    return outcome;
  }

  private keepTokens({ accessToken, refreshToken }: Schemas['TokenPair']): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  private habits(status: 'active' | 'archived'): Promise<HabitWithCompletions[]> {
    return this.request('GET', `/habits?status=${status}`).then((response) =>
      expectStatus<HabitWithCompletions[]>(response, 200)
    );
  }

  /** Active or archived: a test names a habit the same way in either state. */
  private async habitNamed(name: string): Promise<HabitWithCompletions> {
    const all = expectStatus<HabitWithCompletions[]>(await this.request('GET', '/habits'), 200);
    const habit = all.find((candidate) => candidate.name === name);
    if (!habit) throw new Error(`The acting user has no habit named "${name}"`);
    return habit;
  }

  private async setStatus(name: string, status: 'active' | 'archived'): Promise<void> {
    const habit = await this.habitNamed(name);
    // PUT replaces the name, so it goes back unchanged.
    const input: Schemas['HabitInput'] = { name: habit.name, status };
    expectStatus(await this.request('PUT', `/habits/${habit.id}`, input), 200);
  }

  /**
   * Read through the range endpoint, as the web app's views do, so any day is
   * in reach: GET /habits embeds only the last year.
   */
  private async completionOn(
    habitName: string,
    date: IsoDate
  ): Promise<Schemas['Completion'] | undefined> {
    const habit = await this.habitNamed(habitName);
    const period = await this.completionsBetween(date, date);
    const entry = period.find((candidate) => candidate.habitId === habit.id);
    if (!entry) throw new Error(`The period ${date} does not list "${habitName}"`);
    return entry.completions.find((completion) => completion.date === date);
  }

  private async completionsBetween(from: IsoDate, to: IsoDate): Promise<HabitCompletions[]> {
    const query = new URLSearchParams({ startDate: from, endDate: to });
    return expectStatus<HabitCompletions[]>(
      await this.request('GET', `/completions?${query}`),
      200
    );
  }

  /** Make one request and check the response against the API Description. */
  private async request(
    method: string,
    pathAndQuery: string,
    body?: unknown,
    { cookie }: { cookie?: string } = {}
  ): Promise<Response> {
    const url = new URL(`/api/v1${pathAndQuery}`, this.baseUrl);
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    if (cookie) headers.Cookie = cookie;

    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const isJson = response.headers.get('content-type')?.includes('application/json');
    // A non-JSON body is passed through as text, so the contract check reports
    // it rather than JSON.parse throwing something unhelpful.
    const parsed: unknown = !text ? undefined : isJson ? JSON.parse(text) : text;

    assertDocumentedResponse(method, url.pathname, response.status, parsed);
    return { status: response.status, body: parsed };
  }
}

/**
 * The body of a step that should simply work. Any other status is a test
 * failure, not a value to hand back.
 */
function expectStatus<T = unknown>({ status, body }: Response, expected: number): T {
  if (status !== expected) {
    throw new Error(`expected ${expected}, got ${status}: ${JSON.stringify(body)}`);
  }
  return body as T;
}

/** Success, a refusal this operation documents, or a thrown failure. */
function outcomeOf(response: Response, expected: number, refusals: Refusals): Outcome {
  if (response.status === expected) return OK;
  const refusal = refusals[response.status];
  if (refusal) return { ok: false, refusal };
  return expectStatus(response, expected);
}
