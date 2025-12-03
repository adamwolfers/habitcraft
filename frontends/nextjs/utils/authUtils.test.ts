import { validateRegistrationForm } from "./authUtils";

describe("validateRegistrationForm", () => {
  describe("password length validation", () => {
    it("returns error when password is less than 8 characters", () => {
      const result = validateRegistrationForm({
        password: "short",
        confirmPassword: "short",
      });
      expect(result).toBe("Password must be at least 8 characters");
    });

    it("returns error when password is exactly 7 characters", () => {
      const result = validateRegistrationForm({
        password: "1234567",
        confirmPassword: "1234567",
      });
      expect(result).toBe("Password must be at least 8 characters");
    });

    it("accepts password with exactly 8 characters", () => {
      const result = validateRegistrationForm({
        password: "12345678",
        confirmPassword: "12345678",
      });
      expect(result).toBeNull();
    });
  });

  describe("password match validation", () => {
    it("returns error when passwords do not match", () => {
      const result = validateRegistrationForm({
        password: "validpassword123",
        confirmPassword: "differentpassword",
      });
      expect(result).toBe("Passwords do not match");
    });

    it("accepts when passwords match", () => {
      const result = validateRegistrationForm({
        password: "validpassword123",
        confirmPassword: "validpassword123",
      });
      expect(result).toBeNull();
    });
  });

  describe("validation order", () => {
    it("checks password length before password match", () => {
      // Both validations fail, but length should be checked first
      const result = validateRegistrationForm({
        password: "short",
        confirmPassword: "different",
      });
      expect(result).toBe("Password must be at least 8 characters");
    });
  });
});
