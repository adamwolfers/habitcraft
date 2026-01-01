import { getDefaultHabitFormValues, HabitFormState, getEmptyPasswordState, PasswordFormState } from "./formUtils";
import { PRESET_COLORS, PRESET_ICONS } from "./habitUtils";

describe("getDefaultHabitFormValues", () => {
  it("returns default values for habit form", () => {
    const defaults = getDefaultHabitFormValues();

    expect(defaults.name).toBe("");
    expect(defaults.description).toBe("");
    expect(defaults.color).toBe(PRESET_COLORS[0]);
    expect(defaults.icon).toBe(PRESET_ICONS[0]);
  });

  it("returns correct types", () => {
    const defaults: HabitFormState = getDefaultHabitFormValues();

    expect(typeof defaults.name).toBe("string");
    expect(typeof defaults.description).toBe("string");
    expect(typeof defaults.color).toBe("string");
    expect(typeof defaults.icon).toBe("string");
  });

  it("uses first preset color", () => {
    const defaults = getDefaultHabitFormValues();
    expect(defaults.color).toBe("#3b82f6"); // blue
  });

  it("uses first preset icon", () => {
    const defaults = getDefaultHabitFormValues();
    expect(defaults.icon).toBe("🏃");
  });

  it("returns a new object each time (not a reference)", () => {
    const defaults1 = getDefaultHabitFormValues();
    const defaults2 = getDefaultHabitFormValues();

    expect(defaults1).not.toBe(defaults2);
    expect(defaults1).toEqual(defaults2);
  });
});

describe("getEmptyPasswordState", () => {
  it("returns all empty strings for password fields", () => {
    const state = getEmptyPasswordState();

    expect(state.currentPassword).toBe("");
    expect(state.newPassword).toBe("");
    expect(state.confirmPassword).toBe("");
  });

  it("returns correct types", () => {
    const state: PasswordFormState = getEmptyPasswordState();

    expect(typeof state.currentPassword).toBe("string");
    expect(typeof state.newPassword).toBe("string");
    expect(typeof state.confirmPassword).toBe("string");
  });

  it("returns a new object each time (not a reference)", () => {
    const state1 = getEmptyPasswordState();
    const state2 = getEmptyPasswordState();

    expect(state1).not.toBe(state2);
    expect(state1).toEqual(state2);
  });
});
