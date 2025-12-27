import { Completion } from "@/types/habit";

/**
 * Filters completions by date, either including or excluding matches.
 * Handles dates in both YYYY-MM-DD and ISO timestamp formats.
 *
 * @param completions - Array of completions to filter
 * @param dateString - Date to match against in YYYY-MM-DD format
 * @param mode - "include" to keep matching dates, "exclude" to remove them
 * @returns Filtered array of completions
 */
export function filterCompletionsByDate(
  completions: Completion[],
  dateString: string,
  mode: "include" | "exclude"
): Completion[] {
  return completions.filter((completion) => {
    // Strip timestamp from completion.date if it exists
    const completionDate = completion.date.split("T")[0];
    const matches = completionDate === dateString;
    return mode === "include" ? matches : !matches;
  });
}
