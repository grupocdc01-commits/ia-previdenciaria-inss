import { describe, expect, it } from "vitest";
import { buildDocumentDossier } from "@/lib/api/document-dossier.server";
import {
  calendarDate,
  dossierRequestSchema,
  reviewRequestSchema,
  type DossierRequest,
} from "@/lib/document-dossier-schema";
import { toDay } from "@/lib/legal/periods";
import { fixtureDoc, selectedPeriod, THREAD, TODAY, DOC } from "./fixtures/document-dossier";
const now = Date.parse("2026-10-30T12:00:00Z");
const build = (periods: DossierRequest["periods"] = [], docs = [fixtureDoc()]) =>
  buildDocumentDossier({ operation: "dossier", threadId: THREAD, periods }, docs, TODAY, now);

describe("module 3 simple", () => {
  it("unions declared and owner-reviewed dates without counting overlaps twice", () => {
    const result = build([
      selectedPeriod,
      { origin: "declared", start: "2020-01-05", end: "2020-01-15" },
    ]);
    expect(result.arithmetic).toMatchObject({
      unionDays: 15,
      reviewedDays: 10,
      declaredOnlyDays: 5,
      overlapsRemovedDays: 6,
      inclusiveEndpoints: true,
    });
    expect(result.periods.every((p) => p.legallyProven === false)).toBe(true);
    expect(result.contributionTime.value).toBeNull();
    expect(result.carencia.value).toBeNull();
    expect(result.pdfAvailable).toBe(false);
    expect(result.canConclude).toBe(false);
  });
  it("keeps CNIS and CTPS optional and never treats empty inputs as no contributions", () => {
    const result = build([], []);
    expect(result.arithmetic.unionDays).toBe(0);
    expect(result.gaps.join(" ")).toContain("não significa ausência");
    expect(result.gaps.join(" ")).toContain("opcionais");
  });
  it("keeps hash, extraction version, field indexes and pages in provenance", () => {
    const result = build([selectedPeriod]);
    expect(result.periods[0]).toMatchObject({
      sha256: "a".repeat(64),
      pages: [1, 1],
      extractionVersion: "administrative-v1",
      reviewRevision: 1,
    });
    expect(result.documents[0]).toMatchObject({ confirmed: 2, pending: 1, rejected: 0 });
    expect(result.legalReferences.every((r) => r.status === "pending_legal_review")).toBe(true);
  });
  it("counts leap days and a one-day interval inclusively", () => {
    expect(
      build([{ origin: "declared", start: "2024-02-28", end: "2024-03-01" }]).arithmetic.unionDays,
    ).toBe(3);
    expect(
      build([{ origin: "declared", start: "2024-02-29", end: "2024-02-29" }]).arithmetic.unionDays,
    ).toBe(1);
  });
});
describe("module 3 medium", () => {
  it.each([
    "2023-02-29",
    "2024-02-30",
    "2026-04-31",
    "2026-13-01",
    "2026-1-01",
    "2026-01-01T12:00:00Z",
    "not-a-date",
  ])("rejects normalized or non-calendar date %s", (value) => {
    expect(calendarDate.safeParse(value).success).toBe(false);
    expect(() => toDay(value)).toThrow();
  });
  it.each([
    { start: "2020-01-02", end: "2020-01-01" },
    { start: "2020-01-01", end: "2026-10-31" },
    { start: "1899-12-31", end: "1900-01-01" },
  ])("rejects reversed, future or unsupported dates %j", (dates) =>
    expect(() => build([{ origin: "declared", ...dates }])).toThrow(),
  );
  it.each(["pending", "rejected"])("excludes %s document fields", (decision) =>
    expect(() =>
      build(
        [selectedPeriod],
        [fixtureDoc({ administrative_review: [decision, "confirmed", "pending"] })],
      ),
    ).toThrow(),
  );
  it("rejects stale reviews, unavailable documents and another thread", () => {
    expect(() => build([{ ...selectedPeriod, reviewRevision: 2 }])).toThrow();
    expect(() => build([selectedPeriod], [])).toThrow();
    expect(() => build([selectedPeriod], [fixtureDoc({ investigation_id: DOC })])).toThrow();
  });
  it("rejects expiry and deletion but allows a document until its exact expiry", () => {
    expect(() =>
      build([selectedPeriod], [fixtureDoc({ delete_after: new Date(now).toISOString() })]),
    ).toThrow();
    expect(() => build([selectedPeriod], [fixtureDoc({ deletion_state: "deleting" })])).toThrow();
    expect(
      build([selectedPeriod], [fixtureDoc({ delete_after: new Date(now + 1).toISOString() })])
        .arithmetic.unionDays,
    ).toBe(10);
  });
  it("never pairs the wrong type of field or invents an end date", () => {
    expect(() => build([{ ...selectedPeriod, endField: 2 }])).toThrow();
    expect(() => build([{ ...selectedPeriod, endField: 99 }])).toThrow();
  });
  it("rejects unsupported fields and excess periods at the boundary", () => {
    expect(
      dossierRequestSchema.safeParse({
        operation: "dossier",
        threadId: THREAD,
        periods: [],
        eligible: true,
      }).success,
    ).toBe(false);
    expect(() =>
      build(
        Array.from({ length: 501 }, () => ({
          origin: "declared",
          start: "2020-01-01",
          end: "2020-01-02",
        })),
      ),
    ).toThrow();
  });
  it("does not permit replacing extracted values or promoting proof via review payload", () => {
    expect(
      reviewRequestSchema.safeParse({
        operation: "review",
        documentId: DOC,
        sha256: "a".repeat(64),
        extractionVersion: "v1",
        expectedRevision: 0,
        decisions: ["confirmed"],
        proven: true,
      }).success,
    ).toBe(false);
  });
  it("does not mutate input or share report state", () => {
    const doc = fixtureDoc();
    const before = JSON.stringify(doc);
    build([selectedPeriod], [doc]);
    expect(JSON.stringify(doc)).toBe(before);
    expect(build([], []).documents).toEqual([]);
  });
});
describe("module 3 high stress", () => {
  it("handles 500 duplicate periods with bounded diagnostics and exact union", () => {
    const result = build(
      Array.from({ length: 500 }, () => ({
        origin: "declared",
        start: "2020-01-01",
        end: "2020-12-31",
      })),
    );
    expect(result.arithmetic).toMatchObject({ unionDays: 366, overlapsRemovedDays: 499 * 366 });
    expect(result.divergences).toHaveLength(100);
    expect(result.gaps.join(" ")).toContain("124750");
  });
  it("keeps 200 concurrent logical reports isolated and stable", async () => {
    const results = await Promise.all(
      Array.from({ length: 200 }, (_, i) =>
        Promise.resolve().then(() => build(i % 2 ? [selectedPeriod] : [])),
      ),
    );
    results.forEach((result, i) => expect(result.arithmetic.unionDays).toBe(i % 2 ? 10 : 0));
    expect(results.every((r) => !r.canConclude)).toBe(true);
  });
});
