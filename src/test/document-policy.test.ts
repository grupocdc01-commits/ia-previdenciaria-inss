import { describe, expect, it } from "vitest";
import { documentExpiry, safeExtraction, validateDocumentBytes, MAX_DOCUMENT_BYTES } from "@/lib/document-policy";
import { unionPeriodDays, requireReleasedLegalRule } from "@/lib/legal-registry";

describe("private document safeguards", () => {
  it("requires real supported bytes instead of trusting the MIME label", () => {
    expect(() => validateDocumentBytes(new TextEncoder().encode("fake PDF"), "application/pdf")).toThrow();
    expect(() => validateDocumentBytes(new TextEncoder().encode("%PDF-1.4"), "application/pdf")).not.toThrow();
    expect(() => validateDocumentBytes(new TextEncoder().encode("<svg/>"), "image/svg+xml")).toThrow();
  });
  it("limits documents to 10 MB", () => {
    expect(MAX_DOCUMENT_BYTES).toBe(10485760);
    expect(() => validateDocumentBytes(new Uint8Array(10485761), "application/pdf")).toThrow();
  });
  it("never invents a retention deadline", () => {
    expect(documentExpiry("2026-10-28T00:00:00Z", null)).toBeNull();
    expect(documentExpiry("2026-10-28T00:00:00Z", 7)).toBe("2026-11-04T00:00:00.000Z");
  });
  it("discards medical extraction fields", () => {
    expect(safeExtraction({ documentType: "medico", fields: [{ field: "motivo_administrativo", value: "sensitive", page: 1, quote: "sensitive" }], limitations: [] }).fields).toEqual([]);
  });
  it("requires provenance for every proposed administrative field", () => {
    expect(() => safeExtraction({ documentType: "cnis", fields: [{ field: "empregador", value: "Empresa" }], limitations: [] })).toThrow();
  });
  it("does not persist CPF or explicit medical excerpts in proposed fields", () => {
    expect(safeExtraction({ documentType: "indeferimento", fields: [{ field: "motivo_administrativo", value: "Diagnóstico CID10", page: 1, quote: "CPF 123.456.789-00" }], limitations: [] }).fields).toEqual([]);
  });
});
describe("deterministic unreleased legal primitives", () => {
  it("does not count overlapping verified periods twice", () => {
    expect(unionPeriodDays([{ start: 1, end: 10 }, { start: 5, end: 15 }])).toBe(15);
  });
  it("blocks a draft rule even with an executable specification", () => {
    expect(() => requireReleasedLegalRule({ status: "draft", executable_spec: {}, reviewer_reference: "reviewer", reviewed_at: "2026-10-28", source_sha256: "hash" })).toThrow();
  });
});