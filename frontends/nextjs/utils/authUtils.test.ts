import { validateRegistrationForm, validatePasswordChange } from "./authUtils";

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

describe("validatePasswordChange", () => {
  describe("current password validation", () => {
    it("returns error when current password is empty", () => {
      const result = validatePasswordChange({
        currentPassword: "",
        newPassword: "newpassword123",
        confirmPassword: "newpassword123",
      });
      expect(result).toBe("Current password is required");
    });
  });

  describe("new password length validation", () => {
    it("returns error when new password is less than 8 characters", () => {
      const result = validatePasswordChange({
        currentPassword: "currentpass",
        newPassword: "short",
        confirmPassword: "short",
      });
      expect(result).toBe("New password must be at least 8 characters");
    });

    it("returns error when new password is exactly 7 characters", () => {
      const result = validatePasswordChange({
        currentPassword: "currentpass",
        newPassword: "1234567",
        confirmPassword: "1234567",
      });
      expect(result).toBe("New password must be at least 8 characters");
    });

    it("accepts new password with exactly 8 characters", () => {
      const result = validatePasswordChange({
        currentPassword: "currentpass",
        newPassword: "12345678",
        confirmPassword: "12345678",
      });
      expect(result).toBeNull();
    });
  });

  describe("password match validation", () => {
    it("returns error when passwords do not match", () => {
      const result = validatePasswordChange({
        currentPassword: "currentpass",
        newPassword: "validpassword123",
        confirmPassword: "differentpassword",
      });
      expect(result).toBe("Passwords do not match");
    });

    it("accepts when passwords match", () => {
      const result = validatePasswordChange({
        currentPassword: "currentpass",
        newPassword: "validpassword123",
        confirmPassword: "validpassword123",
      });
      expect(result).toBeNull();
    });
  });

  describe("validation order", () => {
    it("checks current password before new password length", () => {
      const result = validatePasswordChange({
        currentPassword: "",
        newPassword: "short",
        confirmPassword: "short",
      });
      expect(result).toBe("Current password is required");
    });

    it("checks new password length before password match", () => {
      const result = validatePasswordChange({
        currentPassword: "currentpass",
        newPassword: "short",
        confirmPassword: "different",
      });
      expect(result).toBe("New password must be at least 8 characters");
    });
  });

  describe("valid input", () => {
    it("returns null for valid password change data", () => {
      const result = validatePasswordChange({
        currentPassword: "oldpassword123",
        newPassword: "newpassword456",
        confirmPassword: "newpassword456",
      });
      expect(result).toBeNull();
    });
  });
});
