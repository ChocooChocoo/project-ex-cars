import { describe, expect, it } from "vitest";

import { newPasswordSchema, passwordSchema } from "./forms";

function firstError(value: string) {
  const result = newPasswordSchema.safeParse(value);
  return result.success ? null : result.error.issues[0]?.message;
}

describe("newPasswordSchema", () => {
  it.each([
    ["abcdef1!", "Add an uppercase letter."],
    ["ABCDEF1!", "Add a lowercase letter."],
    ["Abcdefg!", "Add a number."],
    ["Abcdefg1", "Add a special character."],
    ["Abcdef 1", "Add a special character."],
    ["Ab1!", "Password must be at least 8 characters."],
  ])("refuses %s", (value, message) => {
    expect(firstError(value)).toBe(message);
  });

  it("accepts a password with every character type", () => {
    expect(newPasswordSchema.safeParse("Abcdef1!").success).toBe(true);
  });
});

describe("passwordSchema (sign-in)", () => {
  it("still accepts an older 8-character password without symbols", () => {
    expect(passwordSchema.safeParse("abcdefgh").success).toBe(true);
  });
});
