/**
 * The SPA protocol driver: performs each user action by clicking through the
 * Vite web app (web/) that the Go server serves, in a real browser, and reads
 * every observation off the screen. It replaces the web driver at cutover,
 * when the Next.js app goes.
 *
 * Selectors live here and nowhere else, and they are roles and labels, never
 * classes. Each sign-in or registration opens a fresh browser context, as a
 * second person would use their own browser. Contexts run in UTC, as the DSL
 * resolves "today" in UTC, so the Today view's day is the DSL's today.
 *
 * Today is read and changed on the Today view. Any other day, and any note,
 * waits on the habit detail page (habitcraft-vxln.16).
 *
 * Refusals reach the user as messages on screen. The driver maps the ones it
 * knows onto a Refusal and throws on any other, so a reworded message fails
 * loudly instead of passing as the wrong refusal.
 */

import {
  expect,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import type {
  Account,
  Credentials,
  IsoDate,
  Outcome,
  Profile,
  ProtocolDriver,
  Refusal,
} from '../driver.ts';

/** The messages one action can show, and which refusal each one means. */
type Messages = [RegExp, Refusal][];

const OK: Outcome = { ok: true };

const REFUSED_AS_INVALID: Outcome = { ok: false, refusal: 'invalid-input' };

/** The server refused what was sent (web/src/api/messages.ts). */
const NOT_VALID: [RegExp, Refusal] = [/^Some details are not valid/, 'invalid-input'];

export class SpaDriver implements ProtocolDriver {
  private context: BrowserContext | undefined;
  private current: Page | undefined;

  constructor(
    private readonly browser: Browser,
    private readonly baseUrl: string
  ) {}

  // --- account and session --------------------------------------------------

  async register({ email, password, name }: Account): Promise<Outcome> {
    const page = await this.freshBrowser();
    await page.goto('/register');
    const form = page.locator('form');
    const fields = [
      await fill(form.getByLabel('Name'), name),
      await fill(form.getByLabel('Email'), email),
      await fill(form.getByLabel('Password'), password),
    ];
    if (fields.some((accepted) => !accepted)) return REFUSED_AS_INVALID;
    await form.getByRole('button', { name: 'Create account' }).click();

    return this.outcome('register', () => todayHeading(page).isVisible(), page.getByRole('alert'), [
      [/already exists/, 'email-taken'],
      NOT_VALID,
    ]);
  }

  async signIn({ email, password }: Credentials): Promise<Outcome> {
    const page = await this.freshBrowser();
    await page.goto('/login');
    const form = page.locator('form');
    await form.getByLabel('Email').fill(email);
    await form.getByLabel('Password').fill(password);
    await form.getByRole('button', { name: 'Sign in' }).click();

    return this.outcome('sign in', () => todayHeading(page).isVisible(), page.getByRole('alert'), [
      [/^Wrong email or password/, 'invalid-credentials'],
    ]);
  }

  async signOut(): Promise<void> {
    const page = await this.signedIn('/habits');
    await page.getByRole('navigation').getByRole('button', { name: 'Sign out' }).click();
    await expect(signInHeading(page)).toBeVisible();
  }

  /**
   * Come back after the access token has run out: drop its cookie, as the
   * browser does when it expires, and reload. The app renews the session from
   * the refresh token, or shows the sign-in page.
   */
  async renewSession(): Promise<Outcome> {
    if (!(await this.open('/habits'))) return { ok: false, refusal: 'signed-out' };
    await this.context?.clearCookies({ name: 'accessToken' });
    return (await this.open('/habits')) ? OK : { ok: false, refusal: 'signed-out' };
  }

  async isSignedIn(): Promise<boolean> {
    return (await this.open('/habits')) !== undefined;
  }

  // --- profile --------------------------------------------------------------

  async profile(): Promise<Profile> {
    const details = await this.profileSection('Your details');
    return {
      name: await details.getByLabel('Name').inputValue(),
      email: await details.getByLabel('Email').inputValue(),
    };
  }

  async updateProfile(changes: Partial<Profile>): Promise<Outcome> {
    const details = await this.profileSection('Your details');
    const fields = [
      changes.name === undefined || (await fill(details.getByLabel('Name'), changes.name)),
      changes.email === undefined || (await fill(details.getByLabel('Email'), changes.email)),
    ];
    if (fields.some((accepted) => !accepted)) return REFUSED_AS_INVALID;
    await details.getByRole('button', { name: 'Save profile' }).click();

    return this.outcome(
      'update the profile',
      () => details.getByRole('status').filter({ hasText: 'Profile saved' }).isVisible(),
      details.getByRole('alert'),
      [[/already in use/, 'email-taken'], NOT_VALID]
    );
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<Outcome> {
    const section = await this.profileSection('Change password');
    await section.getByLabel('Current password').fill(currentPassword);
    const fields = [
      await fill(section.getByLabel('New password', { exact: true }), newPassword),
      await fill(section.getByLabel('Confirm new password'), newPassword),
    ];
    if (fields.some((accepted) => !accepted)) return REFUSED_AS_INVALID;
    await section.getByRole('button', { name: 'Change password' }).click();

    return this.outcome(
      'change password',
      () => section.getByRole('status').filter({ hasText: 'Password changed' }).isVisible(),
      section.getByRole('alert'),
      [[/current password is wrong/, 'wrong-password'], NOT_VALID]
    );
  }

  async deleteAccount(password: string): Promise<Outcome> {
    const section = await this.profileSection('Delete account');
    await section.getByRole('button', { name: 'Delete account…' }).click();
    await section.getByLabel('Your password').fill(password);
    await section.getByRole('button', { name: 'Delete my account' }).click();

    const page = this.page;
    return this.outcome(
      'delete the account',
      () => signInHeading(page).isVisible(),
      section.getByRole('alert'),
      [[/password is wrong/, 'wrong-password']]
    );
  }

  // --- habits ---------------------------------------------------------------

  async createHabit(name: string): Promise<Outcome> {
    const page = await this.habitsPage();
    const form = page.getByRole('form', { name: 'Add a habit' });
    if (!(await fill(form.getByLabel('New habit'), name))) return REFUSED_AS_INVALID;
    await form.getByRole('button', { name: 'Add habit' }).click();

    return this.outcome(
      'create a habit',
      async () => (await this.namesIn(page, 'Active habits')).includes(name),
      form.getByRole('alert'),
      [NOT_VALID]
    );
  }

  async renameHabit(name: string, newName: string): Promise<Outcome> {
    await (
      await this.row(name, 'Active habits')
    )
      .getByRole('button', { name: `Rename ${name}` })
      .click();
    // The form takes the name's place, so the row is now the one holding it.
    const page = this.page;
    const form = page.getByRole('form', { name: `Rename ${name}` });
    const row = page.getByRole('listitem').filter({ has: form });
    if (!(await fill(form.getByLabel('Name'), newName))) return REFUSED_AS_INVALID;
    await form.getByRole('button', { name: 'Save' }).click();

    return this.outcome(
      'rename a habit',
      async () => (await this.namesIn(page, 'Active habits')).includes(newName),
      row.getByRole('alert'),
      [NOT_VALID]
    );
  }

  async archiveHabit(name: string): Promise<void> {
    const row = await this.row(name, 'Active habits');
    await row.getByRole('button', { name: `Archive ${name}` }).click();
    await expect(this.listed(name, 'Archived habits'), `"${name}" archived`).toHaveCount(1);
  }

  async restoreHabit(name: string): Promise<void> {
    const row = await this.row(name, 'Archived habits');
    await row.getByRole('button', { name: `Restore ${name}` }).click();
    await expect(this.listed(name, 'Active habits'), `"${name}" restored`).toHaveCount(1);
  }

  async deleteHabit(name: string): Promise<void> {
    const row = await this.row(name);
    await row.getByRole('button', { name: `Delete ${name}` }).click();
    await row.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(this.listed(name), `"${name}" deleted`).toHaveCount(0);
  }

  async habitNames(): Promise<string[]> {
    return this.namesIn(await this.habitsPage(), 'Active habits');
  }

  async archivedHabitNames(): Promise<string[]> {
    return this.namesIn(await this.habitsPage(), 'Archived habits');
  }

  // --- completions ----------------------------------------------------------
  // Which scenarios wait on the rest: dsl/knownBugs.ts.

  async checkOff(habitName: string, date: IsoDate, note?: string): Promise<Outcome> {
    if (date !== today() || note !== undefined)
      return notBuilt('check off another day, or note one');
    const page = await this.todayPage();
    if ((await this.completedToday(page)).includes(habitName)) {
      return { ok: false, refusal: 'already-checked-off' };
    }
    const row = await this.toDoRow(page, habitName);
    await row.getByRole('button', { name: `Check off ${habitName}` }).click();

    return this.outcome(
      'check a habit off',
      async () => (await row.count()) === 0,
      row.getByRole('alert'),
      []
    );
  }

  async uncheck(habitName: string, date: IsoDate): Promise<void> {
    if (date !== today()) notBuilt('uncheck another day');
    const page = await this.todayPage();
    const done = await this.doneRow(page, habitName);
    await done.getByRole('button', { name: `Undo ${habitName}` }).click();
    // A day with a note asks first, since undoing it deletes the note.
    const confirm = done.getByRole('button', { name: 'Undo and delete note' });
    const toDo = this.toDo(page, habitName);
    await expect(toDo.or(confirm)).toBeVisible();
    if (await confirm.isVisible()) await confirm.click();
    await expect(toDo, `"${habitName}" unchecked today`).toHaveCount(1);
  }

  async setNote(): Promise<Outcome> {
    return notBuilt('note a day');
  }

  async isCheckedOff(habitName: string, date: IsoDate): Promise<boolean> {
    if (date !== today()) notBuilt('show whether another day is checked off');
    const page = await this.todayPage();
    if ((await this.toDo(page, habitName).count()) > 0) return false;
    if ((await this.completedToday(page)).includes(habitName)) return true;
    throw new Error(`"${habitName}" is not on the Today view`);
  }

  async noteOn(): Promise<string | null> {
    return notBuilt("show a day's note");
  }

  async checkedOffDays(): Promise<Record<string, IsoDate[]>> {
    return notBuilt('show the days checked off in a period');
  }

  async close(): Promise<void> {
    await this.context?.close();
    this.context = undefined;
    this.current = undefined;
  }

  // --- helpers --------------------------------------------------------------

  private get page(): Page {
    if (!this.current) throw new Error('No browser is open; register or sign in first');
    return this.current;
  }

  /** Start over in a browser with no cookies, as a different person would. */
  private async freshBrowser(): Promise<Page> {
    await this.close();
    this.context = await this.browser.newContext({
      baseURL: this.baseUrl,
      timezoneId: 'UTC',
      locale: 'en-US',
    });
    this.current = await this.context.newPage();
    return this.current;
  }

  /**
   * Load a signed-in page, or return undefined when the app sends the browser
   * to sign in instead.
   */
  private async open(path: string): Promise<Page | undefined> {
    if (!this.current) return undefined;
    const page = this.current;
    await page.goto(path);
    const heading =
      path === '/'
        ? todayHeading(page)
        : path === '/profile'
          ? profileHeading(page)
          : habitsHeading(page);
    await expect(heading.or(signInHeading(page))).toBeVisible();
    return (await signInHeading(page).isVisible()) ? undefined : page;
  }

  private async signedIn(path: string): Promise<Page> {
    const page = await this.open(path);
    if (!page) throw new Error('Expected to be signed in, but the app showed the sign-in page');
    return page;
  }

  /** The Habits page, once the habits have loaded. */
  private async habitsPage(): Promise<Page> {
    const page = await this.signedIn('/habits');
    await expect(page.getByRole('region', { name: 'Active habits' })).toBeVisible();
    return page;
  }

  /** The Today view, once its habits and days have loaded. */
  private async todayPage(): Promise<Page> {
    const page = await this.signedIn('/');
    await expect(
      page.getByRole('region', { name: 'To do' }).or(page.getByText('No habits yet'))
    ).toBeVisible();
    return page;
  }

  /** A habit's row in Today's to-do list; none when it is done or not there. */
  private toDo(page: Page, name: string): Locator {
    return page
      .getByRole('region', { name: 'To do' })
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) });
  }

  private async toDoRow(page: Page, name: string): Promise<Locator> {
    const row = this.toDo(page, name);
    await expect(row, `"${name}" to do today`).toHaveCount(1);
    return row;
  }

  /** Open the collapsed "Completed today" list, when there is one. */
  private async openCompleted(page: Page): Promise<Locator> {
    const region = page.getByRole('region', { name: 'Completed today' });
    const toggle = region.getByRole('button', { name: /^Completed today/ });
    if ((await toggle.count()) > 0 && (await toggle.getAttribute('aria-expanded')) === 'false') {
      await toggle.click();
    }
    return region;
  }

  /** The names of the habits done today; none when the list is hidden. */
  private async completedToday(page: Page): Promise<string[]> {
    return (await this.openCompleted(page))
      .getByRole('listitem')
      .getByRole('heading', { level: 3 })
      .allInnerTexts();
  }

  private async doneRow(page: Page, name: string): Promise<Locator> {
    const row = (await this.openCompleted(page))
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { level: 3, name, exact: true }) });
    await expect(row, `"${name}" done today`).toHaveCount(1);
    return row;
  }

  private async profileSection(name: string): Promise<Locator> {
    const page = await this.signedIn('/profile');
    return page.getByRole('region', { name });
  }

  /** The names in one list on the Habits page; none when it is not shown. */
  private async namesIn(page: Page, list: 'Active habits' | 'Archived habits'): Promise<string[]> {
    return page
      .getByRole('region', { name: list })
      .getByRole('listitem')
      .getByRole('heading', { level: 3 })
      .allInnerTexts();
  }

  /** The habit's row, in one list or in either. */
  private listed(name: string, list?: 'Active habits' | 'Archived habits'): Locator {
    const scope = list ? this.page.getByRole('region', { name: list }) : this.page;
    return scope
      .getByRole('listitem')
      .filter({ has: this.page.getByRole('heading', { level: 3, name, exact: true }) });
  }

  private async row(name: string, list?: 'Active habits' | 'Archived habits'): Promise<Locator> {
    await this.habitsPage();
    const row = this.listed(name, list);
    await expect(row, `a row for "${name}"`).toHaveCount(1);
    return row;
  }

  /**
   * Wait until the action visibly succeeded or a message appeared, then turn
   * the message into the refusal it means. An unknown message throws.
   */
  private async outcome(
    step: string,
    succeeded: () => Promise<boolean>,
    message: Locator,
    messages: Messages
  ): Promise<Outcome> {
    let shown: string | undefined;
    await expect(async () => {
      if (await message.isVisible()) {
        shown = await message.innerText();
        return;
      }
      if (await succeeded()) return;
      throw new Error(`${step}: the app showed neither success nor a message`);
    }).toPass({ timeout: 10_000 });

    if (shown === undefined) return OK;
    const match = messages.find(([pattern]) => pattern.test(shown!));
    if (!match) throw new Error(`${step}: unexpected message "${shown}"`);
    return { ok: false, refusal: match[1] };
  }
}

function todayHeading(page: Page): Locator {
  return page.getByRole('heading', { level: 1, name: 'Today' });
}

function habitsHeading(page: Page): Locator {
  return page.getByRole('heading', { level: 1, name: 'Habits' });
}

function profileHeading(page: Page): Locator {
  return page.getByRole('heading', { level: 1, name: 'Profile' });
}

function signInHeading(page: Page): Locator {
  return page.getByRole('heading', { level: 1, name: 'Sign in' });
}

/**
 * Type a value into a field, and say whether the field took it. A field with
 * a maxLength stops taking characters at the limit, and one that breaks its
 * own rules (required, type=email, minLength) would block the submit: either
 * way the screen has refused the value, and the driver never submits it.
 */
async function fill(field: Locator, value: string): Promise<boolean> {
  await field.fill(value);
  if ((await field.inputValue()) !== value) return false;
  return field.evaluate((element: HTMLInputElement) => element.validity.valid);
}

/** Today in UTC, as the DSL and the driver's browser contexts reckon it. */
function today(): IsoDate {
  return new Date().toISOString().slice(0, 10);
}

function notBuilt(action: string): never {
  throw new Error(`The SPA has no way to ${action} yet`);
}
