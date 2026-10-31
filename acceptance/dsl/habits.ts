import { expect } from '@playwright/test';
import type { CompletionRate, ProtocolDriver } from '../drivers/driver.ts';
import { requestLimits, schemaLimits } from './apiLimits.generated.ts';
import { resolveDay, type Day } from './dates.ts';
import { settle, type Expecting } from './outcomes.ts';
import { describeText, resolveText, type Text } from './text.ts';

const NAME_MAX = schemaLimits.HabitInput.name.maxLength;
const NOTE_MAX = requestLimits.updateCompletionNote.notes.maxLength;

/** The acting user's habits and the days they checked them off. */
export class Habits {
  constructor(private readonly driver: ProtocolDriver) {}

  async create(name: Text, options: Expecting = {}): Promise<void> {
    const outcome = await this.driver.createHabit(resolveText(name, NAME_MAX));
    settle(outcome, options, `create ${describeText(name)}`);
  }

  async rename(name: string, { to, ...options }: Expecting & { to: string }): Promise<void> {
    settle(await this.driver.renameHabit(name, to), options, `rename "${name}" to "${to}"`);
  }

  async archive(name: string): Promise<void> {
    await this.driver.archiveHabit(name);
  }

  async restore(name: string): Promise<void> {
    await this.driver.restoreHabit(name);
  }

  async delete(name: string): Promise<void> {
    await this.driver.deleteHabit(name);
  }

  async checkOff(
    name: string,
    { on, note, ...options }: Expecting & { on: Day; note?: string }
  ): Promise<void> {
    const date = resolveDay(on);
    settle(await this.driver.checkOff(name, date, note), options, `check off "${name}" on ${date}`);
  }

  async uncheck(name: string, { on }: { on: Day }): Promise<void> {
    await this.driver.uncheck(name, resolveDay(on));
  }

  async setNote(
    name: string,
    { on, note, ...options }: Expecting & { on: Day; note: Text }
  ): Promise<void> {
    const date = resolveDay(on);
    const outcome = await this.driver.setNote(name, date, resolveText(note, NOTE_MAX));
    settle(outcome, options, `note ${describeText(note)} on "${name}" for ${date}`);
  }

  async clearNote(name: string, { on }: { on: Day }): Promise<void> {
    const date = resolveDay(on);
    settle(await this.driver.setNote(name, date, null), {}, `clear the note on ${date}`);
  }

  // --- observations ---------------------------------------------------------

  /** Listed among the active habits. */
  async shouldInclude(name: string): Promise<void> {
    expect(await this.driver.habitNames(), `active habits include "${name}"`).toContain(name);
  }

  /** Not listed among the active habits; it may still be archived. */
  async shouldNotInclude(name: string): Promise<void> {
    expect(await this.driver.habitNames(), `active habits exclude "${name}"`).not.toContain(name);
  }

  async shouldBeArchived(name: string): Promise<void> {
    expect(await this.driver.archivedHabitNames(), `"${name}" archived`).toContain(name);
    await this.shouldNotInclude(name);
  }

  /** Gone from both the active and the archived habits. */
  async shouldNotExist(name: string): Promise<void> {
    await this.shouldNotInclude(name);
    expect(await this.driver.archivedHabitNames(), `"${name}" not archived`).not.toContain(name);
  }

  async shouldBeCheckedOff(name: string, { on }: { on: Day }): Promise<void> {
    const date = resolveDay(on);
    expect(await this.driver.isCheckedOff(name, date), `"${name}" checked off on ${date}`).toBe(
      true
    );
  }

  async shouldNotBeCheckedOff(name: string, { on }: { on: Day }): Promise<void> {
    const date = resolveDay(on);
    expect(await this.driver.isCheckedOff(name, date), `"${name}" not checked off on ${date}`).toBe(
      false
    );
  }

  /**
   * Over the period, each habit was checked off on exactly the days listed,
   * and the acting user has no habits but these.
   */
  async shouldShowDays(
    { from, to }: { from: Day; to: Day },
    expected: Record<string, Day[]>
  ): Promise<void> {
    const start = resolveDay(from);
    const end = resolveDay(to);
    const resolved = Object.fromEntries(
      Object.entries(expected).map(([name, days]) => [
        name,
        days.map((day) => resolveDay(day)).sort(),
      ])
    );
    const actual = await this.driver.checkedOffDays(start, end);
    const sorted = Object.fromEntries(
      Object.entries(actual).map(([name, dates]) => [name, [...dates].sort()])
    );
    expect(sorted, `days checked off from ${start} to ${end}`).toEqual(resolved);
  }

  /** The note on a checked-off day; `null` means the day has no note. */
  async shouldHaveNote(name: string, { on, note }: { on: Day; note: Text | null }): Promise<void> {
    const date = resolveDay(on);
    expect(await this.driver.noteOn(name, date), `note on "${name}" for ${date}`).toBe(
      note === null ? null : resolveText(note, NOTE_MAX)
    );
  }

  /**
   * How often the habit was done: `[completed, total]` days over the last 30
   * and the last 365, each window cut to the habit's start.
   */
  async shouldHaveCompletionRates(
    name: string,
    { last30Days, last365Days }: { last30Days: [number, number]; last365Days: [number, number] }
  ): Promise<void> {
    const rate = ([completedDays, totalDays]: [number, number]): CompletionRate => ({
      completedDays,
      totalDays,
    });
    expect(await this.driver.completionRates(name), `completion rates of "${name}"`).toEqual({
      last30Days: rate(last30Days),
      last365Days: rate(last365Days),
    });
  }
}
