import {
  findHabitById,
  detectHabitChanges,
  buildHabitUpdatePayload,
  HabitFormValues,
  PRESET_COLORS,
  PRESET_ICONS,
  getDateButtonFutureClasses,
  getDateCircleStyle,
} from "./habitUtils";
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

describe("detectHabitChanges", () => {
  const originalHabit: Habit = {
    id: "habit-1",
    userId: "user-1",
    name: "Exercise",
    description: "Daily workout",
    frequency: "daily",
    targetDays: [],
    color: "#FF5733",
    icon: "🏃",
    status: "active",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };

  it("returns false when nothing has changed", () => {
    const formValues: HabitFormValues = {
      name: "Exercise",
      description: "Daily workout",
      color: "#FF5733",
      icon: "🏃",
    };
    expect(detectHabitChanges(formValues, originalHabit)).toBe(false);
  });

  it("returns true when name has changed", () => {
    const formValues: HabitFormValues = {
      name: "Morning Exercise",
      description: "Daily workout",
      color: "#FF5733",
      icon: "🏃",
    };
    expect(detectHabitChanges(formValues, originalHabit)).toBe(true);
  });

  it("returns true when description has changed", () => {
    const formValues: HabitFormValues = {
      name: "Exercise",
      description: "Updated description",
      color: "#FF5733",
      icon: "🏃",
    };
    expect(detectHabitChanges(formValues, originalHabit)).toBe(true);
  });

  it("returns true when color has changed", () => {
    const formValues: HabitFormValues = {
      name: "Exercise",
      description: "Daily workout",
      color: "#00FF00",
      icon: "🏃",
    };
    expect(detectHabitChanges(formValues, originalHabit)).toBe(true);
  });

  it("returns true when icon has changed", () => {
    const formValues: HabitFormValues = {
      name: "Exercise",
      description: "Daily workout",
      color: "#FF5733",
      icon: "💪",
    };
    expect(detectHabitChanges(formValues, originalHabit)).toBe(true);
  });

  it("handles null description in original habit", () => {
    const habitWithNullDescription: Habit = {
      ...originalHabit,
      description: null,
    };
    const formValues: HabitFormValues = {
      name: "Exercise",
      description: "",
      color: "#FF5733",
      icon: "🏃",
    };
    expect(detectHabitChanges(formValues, habitWithNullDescription)).toBe(false);
  });

  it("detects change from null description to non-empty", () => {
    const habitWithNullDescription: Habit = {
      ...originalHabit,
      description: null,
    };
    const formValues: HabitFormValues = {
      name: "Exercise",
      description: "New description",
      color: "#FF5733",
      icon: "🏃",
    };
    expect(detectHabitChanges(formValues, habitWithNullDescription)).toBe(true);
  });

  it("detects change from description to empty string", () => {
    const formValues: HabitFormValues = {
      name: "Exercise",
      description: "",
      color: "#FF5733",
      icon: "🏃",
    };
    expect(detectHabitChanges(formValues, originalHabit)).toBe(true);
  });
});

describe("buildHabitUpdatePayload", () => {
  const originalHabit: Habit = {
    id: "habit-1",
    userId: "user-1",
    name: "Exercise",
    description: "Daily workout",
    frequency: "daily",
    targetDays: [],
    color: "#FF5733",
    icon: "🏃",
    status: "active",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };

  it("builds payload with all form values", () => {
    const formValues: HabitFormValues = {
      name: "Morning Exercise",
      description: "Updated workout",
      color: "#00FF00",
      icon: "💪",
    };
    const payload = buildHabitUpdatePayload(formValues, originalHabit);
    expect(payload).toEqual({
      name: "Morning Exercise",
      description: "Updated workout",
      frequency: "daily",
      color: "#00FF00",
      icon: "💪",
    });
  });

  it("converts empty description to null", () => {
    const formValues: HabitFormValues = {
      name: "Exercise",
      description: "",
      color: "#FF5733",
      icon: "🏃",
    };
    const payload = buildHabitUpdatePayload(formValues, originalHabit);
    expect(payload.description).toBeNull();
  });

  it("preserves original frequency in payload", () => {
    const weeklyHabit: Habit = {
      ...originalHabit,
      frequency: "weekly",
    };
    const formValues: HabitFormValues = {
      name: "Exercise",
      description: "Weekly workout",
      color: "#FF5733",
      icon: "🏃",
    };
    const payload = buildHabitUpdatePayload(formValues, weeklyHabit);
    expect(payload.frequency).toBe("weekly");
  });

  it("trims whitespace from name", () => {
    const formValues: HabitFormValues = {
      name: "  Exercise  ",
      description: "Daily workout",
      color: "#FF5733",
      icon: "🏃",
    };
    const payload = buildHabitUpdatePayload(formValues, originalHabit);
    expect(payload.name).toBe("Exercise");
  });

  it("trims whitespace from description", () => {
    const formValues: HabitFormValues = {
      name: "Exercise",
      description: "  Daily workout  ",
      color: "#FF5733",
      icon: "🏃",
    };
    const payload = buildHabitUpdatePayload(formValues, originalHabit);
    expect(payload.description).toBe("Daily workout");
  });
});

describe("getDateButtonFutureClasses", () => {
  it("returns disabled classes for future dates", () => {
    const classes = getDateButtonFutureClasses(true);
    expect(classes).toBe("opacity-50 cursor-not-allowed");
  });

  it("returns hover classes for non-future dates", () => {
    const classes = getDateButtonFutureClasses(false);
    expect(classes).toBe("hover:bg-gray-700");
  });
});

describe("getDateCircleStyle", () => {
  it("returns background color when completed", () => {
    const style = getDateCircleStyle(true, "#3b82f6");
    expect(style).toEqual({ backgroundColor: "#3b82f6" });
  });

  it("returns transparent background when not completed", () => {
    const style = getDateCircleStyle(false, "#3b82f6");
    expect(style).toEqual({ backgroundColor: "transparent" });
  });

  it("handles different colors", () => {
    const style = getDateCircleStyle(true, "#ef4444");
    expect(style).toEqual({ backgroundColor: "#ef4444" });
  });
});
