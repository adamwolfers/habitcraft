/**
 * The API protocol driver: performs each user action as the HTTP calls a
 * client would make, against any server at `baseUrl`. It holds the acting
 * user's access token and sends it as a bearer token, the way the mobile
 * client does, so it needs no cookie jar.
 *
 * Every response is checked against openapi.yaml before the driver looks at
 * it, so a scenario that passes has also proved the server kept the contract.
 */

import type { Account, IsoDate, ProtocolDriver } from '../driver.ts';
import type { components } from './api.generated.ts';
import { assertDocumentedResponse } from './apiDescription.ts';

type Schemas = components['schemas'];

const API = '/api/v1';

export class ApiDriver implements ProtocolDriver {
  private accessToken: string | undefined;

  constructor(private readonly baseUrl: string) {}

  async register(account: Account): Promise<void> {
    const auth = await this.call<Schemas['AuthResponse']>('POST', '/auth/register', 201, account);
    this.accessToken = auth.accessToken;
  }

  async signIn({ email, password }: Pick<Account, 'email' | 'password'>): Promise<void> {
    const auth = await this.call<Schemas['AuthResponse']>('POST', '/auth/login', 200, {
      email,
      password,
    });
    this.accessToken = auth.accessToken;
  }

  async createHabit(name: string): Promise<void> {
    const input: Schemas['HabitInput'] = { name };
    await this.call<Schemas['Habit']>('POST', '/habits', 201, input);
  }

  async checkOff(habitName: string, date: IsoDate): Promise<void> {
    const habit = await this.habitNamed(habitName);
    await this.call<Schemas['Completion']>('POST', `/habits/${habit.id}/completions`, 201, {
      date,
    });
  }

  async habitNames(): Promise<string[]> {
    return (await this.activeHabits()).map((habit) => habit.name);
  }

  async isCheckedOff(habitName: string, date: IsoDate): Promise<boolean> {
    const habit = await this.habitNamed(habitName);
    return habit.completions.some((completion) => completion.date === date);
  }

  async close(): Promise<void> {
    this.accessToken = undefined;
  }

  private activeHabits(): Promise<Schemas['HabitWithCompletions'][]> {
    return this.call('GET', '/habits?status=active', 200);
  }

  private async habitNamed(name: string): Promise<Schemas['HabitWithCompletions']> {
    const habit = (await this.activeHabits()).find((candidate) => candidate.name === name);
    if (!habit) throw new Error(`The acting user has no active habit named "${name}"`);
    return habit;
  }

  /**
   * Make one request and return its parsed body. Fails on a response the API
   * Description does not document, and on any status other than `expected`:
   * a driver step is a user action that should have worked, so a refusal is a
   * test failure, not a value to hand back.
   */
  private async call<T>(
    method: string,
    pathAndQuery: string,
    expected: number,
    body?: unknown
  ): Promise<T> {
    const url = new URL(`${API}${pathAndQuery}`, this.baseUrl);
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;

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
    if (response.status !== expected) {
      throw new Error(
        `${method} ${url.pathname}: expected ${expected}, got ${response.status} ${text}`
      );
    }
    return parsed as T;
  }
}
