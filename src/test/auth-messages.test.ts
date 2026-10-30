import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "@/lib/auth-messages";

describe("friendlyAuthError", () => {
  it("translates wrong credentials", () => {
    expect(friendlyAuthError(new Error("Invalid login credentials"))).toBe(
      "E-mail ou senha incorretos. Confira e tente de novo.",
    );
  });
  it("explains unconfirmed email", () => {
    expect(friendlyAuthError(new Error("Email not confirmed"))).toMatch(/não foi confirmado/);
  });
  it("never leaks unknown technical messages", () => {
    expect(friendlyAuthError(new Error("JWT xyz internal 500"))).toBe(
      "Não foi possível entrar. Tente de novo.",
    );
  });
});
