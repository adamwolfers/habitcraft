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
 * Today is read and changed on the Today view, and a period is read off the
 * Dots view. Any other day, any note and a habit's completion rates are read
 * and changed on its detail page, reached by its card on the Dots view.
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
  CompletionRate,
  CompletionRates,
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

/** The days the Dots view shows for every habit, ending today: 7 rows of 28. */
const DOTS_DAYS = 7 * 28;

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
  // Today without a note goes through the Today view, where signing in lands;
  // every other day, and every note, through the habit's detail page.

  async checkOff(habitName: string, date: IsoDate, note?: string): Promise<Outcome> {
    if (date === today() && note === undefined) return this.checkOffToday(habitName);
    const page = await this.detailPage(habitName);
    // A month after this one cannot be shown, so none of its days can be ticked.
    if (!(await this.toMonth(page, date))) return REFUSED_AS_INVALID;
    const day = this.day(page, date);
    if (await day.isDisabled()) return REFUSED_AS_INVALID;
    if ((await day.getAttribute('aria-pressed')) === 'true') {
      return { ok: false, refusal: 'already-checked-off' };
    }
    await day.click();

    const checked = await this.outcome(
      'check a day off',
      async () => (await day.getAttribute('aria-pressed')) === 'true',
      calendar(page).getByRole('alert'),
      [NOT_VALID]
    );
    if (!checked.ok || note === undefined) return checked;
    return this.writeNote(page, date, note);
  }

  async uncheck(habitName: string, date: IsoDate): Promise<void> {
    if (date === today()) return this.uncheckToday(habitName);
    const page = await this.detailPage(habitName);
    if (!(await this.toMonth(page, date))) throw new Error(`${date} cannot be shown`);
    const day = this.day(page, date);
    await day.click();
    // A day with a note asks first, since undoing it deletes the note.
    const confirm = calendar(page).getByRole('button', { name: 'Undo and delete note' });
    const undone = day.and(page.locator('[aria-pressed="false"]'));
    await expect(undone.or(confirm)).toBeVisible();
    if (await confirm.isVisible()) await confirm.click();
    await expect(undone, `"${habitName}" unchecked on ${date}`).toHaveCount(1);
  }

  async setNote(habitName: string, date: IsoDate, note: string | null): Promise<Outcome> {
    const page = await this.detailPage(habitName);
    if (!(await this.toMonth(page, date))) throw new Error(`${date} cannot be shown`);
    return this.writeNote(page, date, note);
  }

  async isCheckedOff(habitName: string, date: IsoDate): Promise<boolean> {
    if (date === today()) return this.isCheckedOffToday(habitName);
    const page = await this.detailPage(habitName);
    if (!(await this.toMonth(page, date))) return false;
    return (await this.day(page, date).getAttribute('aria-pressed')) === 'true';
  }

  async noteOn(habitName: string, date: IsoDate): Promise<string | null> {
    const page = await this.detailPage(habitName);
    if (!(await this.toMonth(page, date))) throw new Error(`${date} cannot be shown`);
    const done = this.doneDay(page, date);
    if ((await done.count()) === 0) return null;
    const note = done.getByRole('paragraph');
    return (await note.count()) === 0 ? null : note.textContent();
  }

  /**
   * Read each habit's card on the Dots view. A dot is a <time> naming its
   * date, titled with whether that day is done.
   */
  async checkedOffDays(from: IsoDate, to: IsoDate): Promise<Record<string, IsoDate[]>> {
    if (from < addDays(today(), 1 - DOTS_DAYS)) {
      throw new Error(`The Dots view shows only the last ${DOTS_DAYS} days, not back to ${from}`);
    }
    const page = await this.dotsPage();
    const days: Record<string, IsoDate[]> = {};
    for (const card of await this.dotsCards(page).all()) {
      const name = await card.getByRole('heading', { level: 3 }).innerText();
      const dots = await card
        .locator('time')
        .evaluateAll((elements: HTMLTimeElement[]) =>
          elements.map((dot) => ({ date: dot.dateTime, done: dot.title.endsWith(': done') }))
        );
      days[name] = dots
        .filter(({ date, done }) => done && date >= from && date <= to)
        .map(({ date }) => date);
    }
    return days;
  }

  /** Read the habit's detail page: "Last 30 days: 21 of 30 days". */
  async completionRates(habitName: string): Promise<CompletionRates> {
    const page = await this.detailPage(habitName);
    const rates = page.getByRole('region', { name: 'Completion rate' });
    const rate = async (window: string): Promise<CompletionRate> => {
      const item = rates.getByRole('listitem').filter({ hasText: window });
      await expect(item).toHaveText(/\d+ of \d+ days/);
      const [, completedDays, totalDays] = /(\d+) of (\d+) days/.exec(await item.innerText())!;
      return { completedDays: Number(completedDays), totalDays: Number(totalDays) };
    };
    return { last30Days: await rate('Last 30 days'), last365Days: await rate('Last 365 days') };
  }

  async close(): Promise<void> {
    await this.context?.close();
    this.context = undefined;
    this.current = undefined;
  }

  // --- today, on the Today view ----------------------------------------------

  private async checkOffToday(habitName: string): Promise<Outcome> {
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

  private async uncheckToday(habitName: string): Promise<void> {
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

  private async isCheckedOffToday(habitName: string): Promise<boolean> {
    const page = await this.todayPage();
    if ((await this.toDo(page, habitName).count()) > 0) return false;
    if ((await this.completedToday(page)).includes(habitName)) return true;
    throw new Error(`"${habitName}" is not on the Today view`);
  }

  // --- the habit detail page --------------------------------------------------

  /** A habit's detail page, opened from its card on the Dots view. */
  private async detailPage(habitName: string): Promise<Page> {
    const page = await this.dotsPage();
    await this.dotsCards(page)
      .getByRole('heading', { level: 3 })
      .getByRole('link', { name: habitName, exact: true })
      .click();
    await expect(
      page.getByRole('heading', { level: 1, name: habitName, exact: true })
    ).toBeVisible();
    await expect(calendar(page).getByRole('table')).toBeVisible();
    return page;
  }

  /**
   * Step the calendar to the month holding `date`, a month at a time as a
   * person would. False when that month is after this one, which the page
   * does not show.
   */
  private async toMonth(page: Page, date: IsoDate): Promise<boolean> {
    const target = date.slice(0, 7);
    const shown = calendar(page).getByRole('heading', { level: 2 }).locator('time');
    for (;;) {
      const month = await shown.getAttribute('datetime');
      if (month === target) break;
      const step = calendar(page).getByRole('button', {
        name: target < month! ? 'Previous month' : 'Next month',
      });
      if (await step.isDisabled()) return false;
      await step.click();
      await expect(shown).not.toHaveAttribute('datetime', month!);
    }
    await expect(calendar(page).getByRole('table')).toBeVisible();
    return true;
  }

  /** A day's toggle in the calendar, found by the date its <time> names. */
  private day(page: Page, date: IsoDate): Locator {
    return calendar(page)
      .getByRole('table')
      .getByRole('button')
      .filter({ has: page.locator(`time[datetime="${date}"]`) });
  }

  /** A checked-off day in the month's list of days done; none when not done. */
  private doneDay(page: Page, date: IsoDate): Locator {
    return page
      .getByRole('region', { name: 'Days done' })
      .getByRole('listitem')
      .filter({ has: page.locator(`time[datetime="${date}"]`) });
  }

  /** Write, or with null delete, a checked-off day's note in its dialog. */
  private async writeNote(page: Page, date: IsoDate, note: string | null): Promise<Outcome> {
    const done = this.doneDay(page, date);
    await expect(done, `${date} checked off`).toHaveCount(1);
    await done.getByRole('button', { name: /^(Add|Edit) note/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const remove = dialog.getByRole('button', { name: 'Delete note' });
    if (note === null && (await remove.count()) === 0) {
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      return OK;
    }
    if (note === null) {
      await remove.click();
    } else {
      if (!(await fill(dialog.getByLabel('Note'), note))) {
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        return REFUSED_AS_INVALID;
      }
      await dialog.getByRole('button', { name: 'Save' }).click();
    }

    return this.outcome(
      'write a note',
      async () => (await dialog.count()) === 0,
      dialog.getByRole('alert'),
      [NOT_VALID]
    );
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
        : path === '/dots'
          ? dotsHeading(page)
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

  /** The Dots view, once its habits and days have loaded. */
  private async dotsPage(): Promise<Page> {
    const page = await this.signedIn('/dots');
    await expect(this.dotsCards(page).first().or(page.getByText('No habits yet'))).toBeVisible();
    return page;
  }

  /** Each active habit's card on the Dots view. */
  private dotsCards(page: Page): Locator {
    return page
      .getByRole('main')
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { level: 3 }) });
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

function dotsHeading(page: Page): Locator {
  return page.getByRole('heading', { level: 1, name: 'Dots' });
}

function habitsHeading(page: Page): Locator {
  return page.getByRole('heading', { level: 1, name: 'Habits' });
}

function profileHeading(page: Page): Locator {
  return page.getByRole('heading', { level: 1, name: 'Profile' });
}

/** The month calendar on a habit's detail page. */
function calendar(page: Page): Locator {
  return page.getByRole('region', { name: 'Calendar' });
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

/** The date `days` days after `date` (before it, when negative). */
function addDays(date: IsoDate, days: number): IsoDate {
  const moment = new Date(`${date}T00:00:00Z`);
  moment.setUTCDate(moment.getUTCDate() + days);
  return moment.toISOString().slice(0, 10);
}
