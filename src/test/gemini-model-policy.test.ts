import { describe, expect, it } from "vitest";
import { selectAvailableModel } from "@/lib/gemini-model-policy";
describe("Gemini discovery gates", () => {
  it("never accepts a model absent from the API discovery", () => {
    expect(selectAvailableModel([], "economic", "gemini-2.5-flash-lite")).toBeNull();
  });
  it("requires generateContent capability", () => {
    expect(selectAvailableModel([{ name: "models/gemini-2.5-flash-lite", supportedGenerationMethods: ["embedContent"] }], "economic")).toBeNull();
  });
  it("prefers the economic allowlisted model only after validation", () => {
    expect(selectAvailableModel([{ name: "models/gemini-2.5-flash-lite", supportedGenerationMethods: ["generateContent"] }, { name: "models/gemini-2.5-pro", supportedGenerationMethods: ["generateContent"] }], "economic")).toBe("models/gemini-2.5-flash-lite");
  });
  it("rejects an unapproved model even if the API lists it", () => {
    expect(selectAvailableModel([{ name: "models/unreviewed", supportedGenerationMethods: ["generateContent"] }], "economic", "unreviewed")).toBeNull();
  });
});import { friendlyGoogleError, sanitizeGoogleError, freeTierAllowed } from "@/lib/gemini-model-policy";
describe("Gemini flash-lite and errors", () => {
  it("accepts gemini-flash-lite-latest only when the API returns it", () => {
    expect(selectAvailableModel([{ name: "models/gemini-flash-lite-latest", supportedGenerationMethods: ["generateContent"] }], "economic")).toBeNull();
    expect(selectAvailableModel([{ name: "models/gemini-2.5-flash", supportedGenerationMethods: ["generateContent"] }], "economic")).toBeNull();
  });
  it("allows only confirmed free-tier models", () => { expect(freeTierAllowed("models/gemini-3.1-flash-lite")).toBe(true); expect(freeTierAllowed("models/gemini-3.5-flash-lite")).toBe(false); expect(freeTierAllowed("models/gemini-2.5-pro")).toBe(false); });
  it("prefers 3.1 Flash Lite over 2.5 fallback", () => { expect(selectAvailableModel([{ name: "models/gemini-2.5-flash-lite", supportedGenerationMethods: ["generateContent"] }, { name: "models/gemini-3.1-flash-lite", supportedGenerationMethods: ["generateContent"] }], "economic")).toBe("models/gemini-3.1-flash-lite"); });
  it("strips keys from Google errors and maps statuses", () => {
    expect(sanitizeGoogleError("bad key AIzaSyA1234567890abcdefghijklmnop")).not.toContain("AIza");
    expect(friendlyGoogleError(429)).toContain("cota");
    expect(friendlyGoogleError(404)).toContain("não foi encontrado");
  });
});
