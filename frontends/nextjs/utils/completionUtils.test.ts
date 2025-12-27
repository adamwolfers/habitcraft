import { filterCompletionsByDate } from "./completionUtils";
import { Completion } from "@/types/habit";

const createCompletion = (id: string, date: string): Completion => ({
  id,
  habitId: "habit-1",
  date,
  notes: null,
  createdAt: "2025-01-01T00:00:00Z",
});

describe("filterCompletionsByDate", () => {
  const completions: Completion[] = [
    createCompletion("c1", "2025-01-01"),
    createCompletion("c2", "2025-01-02"),
    createCompletion("c3", "2025-01-03"),
  ];

  describe("excluding a date", () => {
    it("removes completions matching the specified date", () => {
      const result = filterCompletionsByDate(completions, "2025-01-02", "exclude");
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.id)).toEqual(["c1", "c3"]);
    });

    it("returns all completions when date does not match any", () => {
      const result = filterCompletionsByDate(completions, "2025-12-31", "exclude");
      expect(result).toHaveLength(3);
    });

    it("handles completions with ISO timestamp format", () => {
      const completionsWithTimestamp: Completion[] = [
        createCompletion("c1", "2025-01-01T10:30:00Z"),
        createCompletion("c2", "2025-01-02T14:00:00Z"),
      ];
      const result = filterCompletionsByDate(completionsWithTimestamp, "2025-01-01", "exclude");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c2");
    });

    it("returns empty array when all completions match the date", () => {
      const sameDay: Completion[] = [
        createCompletion("c1", "2025-01-01"),
        createCompletion("c2", "2025-01-01T12:00:00Z"),
      ];
      const result = filterCompletionsByDate(sameDay, "2025-01-01", "exclude");
      expect(result).toHaveLength(0);
    });
  });

  describe("including a date", () => {
    it("returns only completions matching the specified date", () => {
      const result = filterCompletionsByDate(completions, "2025-01-02", "include");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c2");
    });

    it("returns empty array when date does not match any", () => {
      const result = filterCompletionsByDate(completions, "2025-12-31", "include");
      expect(result).toHaveLength(0);
    });

    it("handles completions with ISO timestamp format", () => {
      const completionsWithTimestamp: Completion[] = [
        createCompletion("c1", "2025-01-01T10:30:00Z"),
        createCompletion("c2", "2025-01-02T14:00:00Z"),
      ];
      const result = filterCompletionsByDate(completionsWithTimestamp, "2025-01-01", "include");
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("c1");
    });

    it("returns all completions when they all match the date", () => {
      const sameDay: Completion[] = [
        createCompletion("c1", "2025-01-01"),
        createCompletion("c2", "2025-01-01T12:00:00Z"),
      ];
      const result = filterCompletionsByDate(sameDay, "2025-01-01", "include");
      expect(result).toHaveLength(2);
    });
  });

  describe("edge cases", () => {
    it("returns empty array when completions array is empty", () => {
      const result = filterCompletionsByDate([], "2025-01-01", "exclude");
      expect(result).toHaveLength(0);
    });

    it("does not mutate the original array", () => {
      const original = [...completions];
      filterCompletionsByDate(completions, "2025-01-01", "exclude");
      expect(completions).toEqual(original);
    });
  });
});
