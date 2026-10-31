/**
 * The web protocol driver: performs each user action by clicking through the
 * web app in a real browser, and reads every observation off the screen.
 *
 * Selectors live here and nowhere else. They target the Next.js app, and this
 * driver goes with it at cutover, when drivers/spa/ takes its place; the test
 * cases above them do not change.
 *
 * Each sign-in or registration opens a fresh browser context, the way a second
 * person would use their own browser. The context runs in UTC, as the DSL
 * resolves "today" in UTC.
 *
 * The product's refusals reach the user as messages on screen. The driver maps
 * the messages it knows onto a Refusal and throws on any other, so a new or
 * reworded message fails loudly instead of passing as the wrong refusal.
 */

import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from '@playwright/test';
import type {
  Account,
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

/** Client-side validation of the password fields, before anything is sent. */
const PASSWORD_RULES: Messages = [[/must be|do not match|required/i, 'invalid-input']];

const REFUSED_AS_INVALID: Outcome = { ok: false, refusal: 'invalid-input' };

const DAY_MS = 24 * 60 * 60 * 1000;

export class WebDriver implements ProtocolDriver {
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
    await page.getByLabel('Name').fill(name);
    const emailField = page.getByLabel('Email');
    await emailField.fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm Password').fill(password);
    if (await isInvalid(emailField)) return REFUSED_AS_INVALID;
    await page.getByRole('button', { name: 'Sign Up' }).click();

    return this.outcome('register', () => this.addHabitButton(page).isVisible(), formError(page), [
      [/already exists/i, 'email-taken'],
      [/must be|do not match/i, 'invalid-input'],
      // The server's own validation failures; see updateProfile.
      [/^registration failed$/i, 'invalid-input'],
    ]);
  }

  async signIn({ email, password }: Credentials): Promise<Outcome> {
    const page = await this.freshBrowser();
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Log In' }).click();

    return this.outcome('sign in', () => this.addHabitButton(page).isVisible(), formError(page), [
      [/invalid credentials/i, 'invalid-credentials'],
    ]);
  }

  async signOut(): Promise<void> {
    const page = await this.dashboard();
    if (!page) return;
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: 'Log Out' }).click();
    await expect(loginHeading(page)).toBeVisible();
  }

  /**
   * Come back after the access token has run out: drop its cookie, as the
   * browser does when it expires, and reload. The app renews the session from
   * the refresh token, or sends the user to the login page.
   */
  async renewSession(): Promise<Outcome> {
    // Settle first: a request still in flight would renew the session at the
    // same moment, and the second use of a rotated refresh token is refused.
    await this.dashboard();
    await this.context?.clearCookies({ name: 'accessToken' });
    return (await this.dashboard()) ? OK : { ok: false, refusal: 'signed-out' };
  }

  async isSignedIn(): Promise<boolean> {
    return (await this.dashboard()) !== undefined;
  }

  // --- profile --------------------------------------------------------------

  async profile(): Promise<Profile> {
    const dialog = await this.profileDialog();
    const profile = {
      name: await dialog.getByLabel('Name', { exact: true }).inputValue(),
      email: await dialog.getByLabel('Email', { exact: true }).inputValue(),
    };
    await dialog.getByRole('button', { name: 'Close' }).click();
    return profile;
  }

  async updateProfile(changes: Partial<Profile>): Promise<Outcome> {
    const dialog = await this.profileDialog();
    if (changes.name !== undefined)
      await dialog.getByLabel('Name', { exact: true }).fill(changes.name);
    if (changes.email !== undefined)
      await dialog.getByLabel('Email', { exact: true }).fill(changes.email);
    // The form holds Save back until the fields pass its own checks.
    const save = dialog.getByRole('button', { name: 'Save' });
    if (await save.isDisabled()) return REFUSED_AS_INVALID;
    await save.click();

    return this.outcome(
      'update the profile',
      async () => !(await dialog.isVisible()),
      dialog.getByRole('alert'),
      [
        [/already in use/i, 'email-taken'],
        // The Next.js app reads only `error` from a refusal, and the server
        // puts validation failures in `errors`, so every one reads the same.
        [/^update failed$/i, 'invalid-input'],
      ]
    );
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<Outcome> {
    const dialog = await this.profileDialog();
    await dialog.getByLabel('Current Password').fill(currentPassword);
    await dialog.getByLabel('New Password').fill(newPassword);
    await dialog.getByLabel('Confirm Password').fill(newPassword);
    await dialog.getByRole('button', { name: 'Change Password' }).click();

    return this.outcome(
      'change password',
      () => dialog.getByRole('status').filter({ hasText: 'Password changed' }).isVisible(),
      dialog.getByRole('alert'),
      [[/invalid current password/i, 'wrong-password'], ...PASSWORD_RULES]
    );
  }

  async deleteAccount(password: string): Promise<Outcome> {
    const dialog = await this.profileDialog();
    await dialog.getByRole('button', { name: 'Delete Account' }).click();
    await dialog.getByLabel('Enter your password to confirm').fill(password);
    await dialog.getByRole('button', { name: 'Permanently Delete' }).click();

    const page = this.page;
    return this.outcome(
      'delete the account',
      () => loginHeading(page).isVisible(),
      dialog.getByRole('alert'),
      [[/invalid password/i, 'wrong-password']]
    );
  }

  // --- habits ---------------------------------------------------------------

  async createHabit(name: string): Promise<Outcome> {
    const page = await this.signedInDashboard();
    await this.addHabitButton(page).click();
    const nameField = page.getByLabel(/habit name/i);
    await nameField.fill(name);
    // The browser would block the submit, or the field cut the name short.
    if ((await isInvalid(nameField)) || !(await holds(nameField, name))) return REFUSED_AS_INVALID;
    await page.getByRole('button', { name: 'Add Habit', exact: true }).click();

    // The form closes on success and stays open with a message otherwise.
    return this.outcome(
      'create a habit',
      () => this.addHabitButton(page).isVisible(),
      formError(page),
      []
    );
  }

  async renameHabit(name: string, newName: string): Promise<Outcome> {
    const dialog = await this.editDialog(name);
    const nameField = dialog.getByLabel('Habit Name', { exact: true });
    await nameField.fill(newName);
    // Read before the click: on success the field is gone straight after it.
    const invalid = await isInvalid(nameField);
    await dialog.getByRole('button', { name: 'Save' }).click();
    if (invalid) return REFUSED_AS_INVALID;

    return this.outcome(
      'rename a habit',
      async () => !(await dialog.isVisible()),
      dialog.getByRole('alert'),
      []
    );
  }

  async archiveHabit(): Promise<void> {
    noSuchControl('archive a habit');
  }

  async restoreHabit(): Promise<void> {
    noSuchControl('restore an archived habit');
  }

  async deleteHabit(name: string): Promise<void> {
    const dialog = await this.editDialog(name);
    await dialog.getByRole('button', { name: 'Delete Habit' }).click();
    await expect(dialog).toBeHidden();
    await expect(this.card(name)).toHaveCount(0);
  }

  async habitNames(): Promise<string[]> {
    const page = await this.signedInDashboard();
    return page.getByRole('heading', { level: 3 }).allInnerTexts();
  }

  /**
   * The Next.js app shows archived habits among the rest and never as
   * archived, so nothing on screen is an archived habit.
   */
  async archivedHabitNames(): Promise<string[]> {
    return [];
  }

  // --- completions ----------------------------------------------------------

  /**
   * Days are toggles: clicking a checked-off day unchecks it. So the screen
   * refuses a second check-off by showing the day as already done, and the
   * driver reports that instead of clicking.
   */
  async checkOff(habitName: string, date: IsoDate, note?: string): Promise<Outcome> {
    const day = await this.day(habitName, date);
    if (await day.isCheckedOff()) return { ok: false, refusal: 'already-checked-off' };
    if (await day.toggle.isDisabled()) return { ok: false, refusal: 'invalid-input' };

    await day.toggle.click();
    await expect(day.noteButton, `${habitName} checked off on ${date}`).toBeVisible();
    return note === undefined ? OK : this.writeNote(day, note);
  }

  async uncheck(habitName: string, date: IsoDate): Promise<void> {
    const day = await this.day(habitName, date);
    if (!(await day.isCheckedOff()))
      throw new Error(`"${habitName}" is not checked off on ${date}`);
    await day.toggle.click();
    await expect(day.noteButton, `${habitName} unchecked on ${date}`).toBeHidden();
  }

  async setNote(habitName: string, date: IsoDate, note: string | null): Promise<Outcome> {
    const day = await this.day(habitName, date);
    if (!(await day.isCheckedOff()))
      throw new Error(`"${habitName}" is not checked off on ${date}`);
    return this.writeNote(day, note);
  }

  async isCheckedOff(habitName: string, date: IsoDate): Promise<boolean> {
    return (await this.day(habitName, date)).isCheckedOff();
  }

  async noteOn(habitName: string, date: IsoDate): Promise<string | null> {
    const day = await this.day(habitName, date);
    if (!(await day.isCheckedOff()))
      throw new Error(`"${habitName}" is not checked off on ${date}`);
    if ((await day.noteButton.getAttribute('aria-label')) === 'Add note') return null;

    await day.noteButton.click();
    const dialog = this.page.getByRole('dialog');
    const note = await dialog.getByRole('textbox').inputValue();
    await dialog.getByRole('button', { name: 'Close' }).click();
    return note;
  }

  /**
   * Read day by day off each habit's card, since the week view shows one
   * habit's week at a time.
   */
  async checkedOffDays(from: IsoDate, to: IsoDate): Promise<Record<string, IsoDate[]>> {
    const days: Record<string, IsoDate[]> = {};
    for (const name of await this.habitNames()) {
      days[name] = [];
      for (const date of datesFrom(from, to)) {
        if (await this.isCheckedOff(name, date)) days[name].push(date);
      }
    }
    return days;
  }

  async completionRates(): Promise<CompletionRates> {
    noSuchControl("show a habit's completion rates");
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
   * Load the dashboard with the acting user's habits on it, or return
   * undefined when the app sends the browser to the login page instead.
   */
  private async dashboard(): Promise<Page | undefined> {
    if (!this.current) return undefined;
    const page = this.current;

    // The dashboard renders an empty list before its one request for habits
    // returns, so the list is only true once that response is drawn. Listening
    // from the commit on skips a request the previous page left in flight.
    await page.goto('/dashboard', { waitUntil: 'commit' });
    const habitsLoaded = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/habits' &&
        response.request().method() === 'GET'
    );
    habitsLoaded.catch(() => {}); // never awaited when signed out

    await expect(this.addHabitButton(page).or(loginHeading(page))).toBeVisible();
    if (await loginHeading(page).isVisible()) return undefined;

    const response = await habitsLoaded;
    expect(response.status(), 'loading habits').toBe(200);
    const count = ((await response.json()) as unknown[]).length;
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(count);
    return page;
  }

  private async signedInDashboard(): Promise<Page> {
    const page = await this.dashboard();
    if (!page) throw new Error('Expected to be signed in, but the app showed the login page');
    return page;
  }

  private addHabitButton(page: Page): Locator {
    return page.getByRole('button', { name: '+ Add New Habit' });
  }

  private async profileDialog(): Promise<Locator> {
    const page = await this.signedInDashboard();
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Profile' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    return dialog;
  }

  private card(habitName: string): Locator {
    return this.page
      .locator('div.bg-gray-800')
      .filter({ has: this.page.getByRole('heading', { level: 3, name: habitName, exact: true }) });
  }

  private async editDialog(habitName: string): Promise<Locator> {
    await this.signedInDashboard();
    await this.card(habitName).getByRole('button', { name: 'Edit habit' }).click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    return dialog;
  }

  /**
   * One day on a habit's card. The card's week view starts on Sunday and steps
   * a week at a time, so the driver pages back or forward to the date's week,
   * where the weekday alone tells the days apart.
   */
  private async day(habitName: string, date: IsoDate): Promise<Day> {
    await this.signedInDashboard();
    const card = this.card(habitName);
    await expect(card, `a card for "${habitName}"`).toHaveCount(1);

    const weeks = Math.round(
      (sundayOf(date) - sundayOf(new Date().toISOString().slice(0, 10))) / (7 * DAY_MS)
    );
    const step = card.getByRole('button', { name: weeks < 0 ? 'Previous week' : 'Next week' });
    for (let i = 0; i < Math.abs(weeks); i++) await step.click();

    const weekday = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
      weekday: 'short',
      timeZone: 'UTC',
    });
    const dayOfMonth = Number(date.slice(8));
    // A `has` locator is resolved inside the element it filters, so it starts
    // from the page, not from the card.
    const named = { name: new RegExp(`^${weekday}\\s*${dayOfMonth}$`) };
    const toggle = card.getByRole('button', named);
    await expect(toggle, `${date} on "${habitName}"`).toHaveCount(1);

    // Only a checked-off day has a note button beneath it.
    const column = card
      .locator('.grid-cols-7 > div')
      .filter({ has: this.page.getByRole('button', named) });
    const noteButton = column.getByRole('button', { name: /^(Add|View) note$/ });
    return { toggle, noteButton, isCheckedOff: async () => (await noteButton.count()) > 0 };
  }

  /**
   * The note box stops taking characters at the limit, so a note it would not
   * hold in full is refused: the driver cancels rather than save a cut-off one.
   */
  private async writeNote(day: Day, note: string | null): Promise<Outcome> {
    await day.noteButton.click();
    const dialog = this.page.getByRole('dialog');
    const hadNote = (await day.noteButton.getAttribute('aria-label')) === 'View note';
    if (note === null) {
      const remove = dialog.getByRole('button', { name: 'Delete Note' });
      await (
        (await remove.isVisible()) ? remove : dialog.getByRole('button', { name: 'Cancel' })
      ).click();
    } else {
      const box = dialog.getByRole('textbox');
      await box.fill(note);
      if (!(await holds(box, note))) {
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(dialog).toBeHidden();
        await expect(day.noteButton).toHaveAccessibleName(hadNote ? 'View note' : 'Add note');
        return REFUSED_AS_INVALID;
      }
      await dialog.getByRole('button', { name: 'Save' }).click();
    }
    // The modal closes only once the server has the note.
    await expect(dialog).toBeHidden();
    await expect(day.noteButton).toHaveAccessibleName(note ? 'View note' : 'Add note');
    return OK;
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

interface Day {
  toggle: Locator;
  noteButton: Locator;
  isCheckedOff(): Promise<boolean>;
}

/** The red message box at the top of the login, register and add-habit forms. */
function formError(page: Page): Locator {
  return page.locator('form > div.border-red-500');
}

function loginHeading(page: Page): Locator {
  return page.getByRole('heading', { name: 'Log In' });
}

/** The browser will block the submit: the field fails its own validation. */
function isInvalid(field: Locator): Promise<boolean> {
  return field.evaluate((element: HTMLInputElement) => !element.validity.valid);
}

/**
 * Whether the field kept everything typed into it. One with a maxLength stops
 * taking characters at the limit, which is how the screen refuses the rest.
 */
async function holds(field: Locator, value: string): Promise<boolean> {
  return (await field.inputValue()) === value;
}

/** Midnight UTC on the Sunday that starts the week holding `date`. */
/** Every date from `from` to `to`, both included. */
function datesFrom(from: IsoDate, to: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY_MS) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
}

function sundayOf(date: IsoDate): number {
  const day = new Date(`${date}T00:00:00Z`);
  return day.getTime() - day.getUTCDay() * DAY_MS;
}

/**
 * The Next.js app has no control for this. The test is skipped on the web
 * protocol, with the reason in the report, until the Vite SPA adds one.
 */
function noSuchControl(action: string): never {
  test.skip(true, `The Next.js app has no way to ${action}`);
  throw new Error('unreachable');
}
