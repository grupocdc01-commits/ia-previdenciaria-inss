import { describe, expect, it } from "vitest";
import { sanitizeDocumentName } from "@/lib/document-policy";

describe("document filename regression", () => {
  it("preserves normal names including accents and emoji", () => {
    expect(sanitizeDocumentName("Declaração 📄.pdf")).toBe("Declaração 📄.pdf");
  });
  it.each(Array.from({ length: 32 }, (_, code) => code))(
    "replaces control character %i",
    (code) => {
      expect(sanitizeDocumentName(`before${String.fromCharCode(code)}after.pdf`)).toBe(
        "before_after.pdf",
      );
    },
  );
  it("removes path separators and limits stored name length", () => {
    expect(sanitizeDocumentName("../folder\\file.pdf")).toBe(".._folder_file.pdf");
    expect(sanitizeDocumentName("a".repeat(200) + ".pdf")).toHaveLength(180);
    expect(sanitizeDocumentName("")).toBe("");
  });
  it("stays deterministic over 10000 adversarial names", () => {
    for (let i = 0; i < 10000; i++) {
      const name = `${String.fromCharCode(i % 32)}a/b\\${"x".repeat(i % 250)}`;
      const safe = sanitizeDocumentName(name);
      expect(safe.length).toBeLessThanOrEqual(180);
      expect(
        [...safe].every((char) => char.charCodeAt(0) > 31 && char !== "/" && char !== "\\"),
      ).toBe(true);
      expect(sanitizeDocumentName(safe)).toBe(safe);
    }
  });
});
