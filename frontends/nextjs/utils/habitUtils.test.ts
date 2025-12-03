import { findHabitById } from "./habitUtils";
import { Habit } from "@/types/habit";

const mockHabit: Habit = {
  id: "habit-1",
  userId: "user-1",
  name: "Exercise",
  description: "Daily workout",
  frequency: "daily",
  targetDays: [],
  color: "#FF5733",
  icon: "dumbbell",
  status: "active",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

const mockHabit2: Habit = {
  ...mockHabit,
  id: "habit-2",
  name: "Reading",
};

describe("findHabitById", () => {
  it("returns the habit when found", () => {
    const habits = [mockHabit, mockHabit2];
    const result = findHabitById(habits, "habit-1");
    expect(result).toBe(mockHabit);
  });

  it("returns undefined when habit is not found", () => {
    const habits = [mockHabit, mockHabit2];
    const result = findHabitById(habits, "non-existent-id");
    expect(result).toBeUndefined();
  });

  it("returns undefined when habits array is empty", () => {
    const result = findHabitById([], "habit-1");
    expect(result).toBeUndefined();
  });
});
