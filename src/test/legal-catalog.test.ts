import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LEGAL_CATALOG,
  findLegalRecord,
  readLegalLibrary,
  resolveLegalCitations,
  validateLegalCatalog,
} from "@/lib/legal/catalog";
import {
  assessLegalRecord,
  isOfficialLegalUrl,
  legalDateSchema,
  legalRecordSchema,
  proposeLegalRevision,
  type LegalRecord,
} from "@/lib/legal/catalog-schema";
import { isSourceTrusted, sourceById, sourceInForce } from "@/lib/legal/sources";
import { evaluate } from "@/lib/legal/engine";
import { plainReport, technicalReport } from "@/lib/legal/report";

const TODAY = "2026-10-30";
const query = { onDate: TODAY };
// Synthetic approval exists only in memory in these tests, never in the live catalog.
function approvedFixture(): LegalRecord {
  const record = structuredClone(LEGAL_CATALOG[0]!);
  record.version = "synthetic-unit-test";
  record.effective = { from: "2020-01-01", until: "2027-01-01", verified: true };
  record.legalStatus = "vigente";
  record.capture = {
    sha256: "a".repeat(64),
    capturedAt: "2026-10-28T00:00:00Z",
    finalUrl: record.url,
    bytes: 100,
    identity: "conferida",
    format: "texto-oficial-v1",
  };
  record.review = {
    status: "aprovada",
    reviewerReference: "synthetic-test-reviewer",
    reviewedAt: "2026-10-29T00:00:00Z",
    captureSha256: "a".repeat(64),
    dueOn: "2026-11-30",
    note: "Synthetic evidence for unit testing only.",
  };
  record.history = [
    { at: "2026-10-28T00:00:00Z", event: "cadastro", reason: "Synthetic fixture" },
    { at: "2026-10-29T00:00:00Z", event: "revisao", reason: "Synthetic review for unit testing" },
  ];
  return record;
}

describe("Módulo 1 — simples", () => {
  it("publishes nine candidates, six laws and three precedents, without legal release", () => {
    const result = readLegalLibrary(query, TODAY);
    expect(result.items).toHaveLength(9);
    expect(result.items.filter((r) => r.kind === "legislacao")).toHaveLength(6);
    expect(result.items.filter((r) => r.kind === "jurisprudencia")).toHaveLength(3);
    expect(result.items.every((r) => !r.assessment.usable)).toBe(true);
    expect(result.moduleStatus).toBe("nao_homologado");
  });
  it("finds articles and accents, filters and paginates deterministically", () => {
    expect(readLegalLibrary({ ...query, query: "art. 103" }, TODAY).items[0]?.id).toBe("lei-8213");
    expect(
      readLegalLibrary({ ...query, query: "sumula 149", kind: "jurisprudencia" }, TODAY).total,
    ).toBe(1);
    const a = readLegalLibrary({ ...query, limit: 5 }, TODAY);
    const b = readLegalLibrary({ ...query, offset: 5, limit: 5 }, TODAY);
    expect(new Set([...a.items, ...b.items].map((r) => r.id)).size).toBe(9);
    expect(b.items).toHaveLength(4);
  });
  it("accepts a fully documented synthetic fixture but never promotes catalog candidates", () => {
    expect(assessLegalRecord(approvedFixture(), TODAY, TODAY).usable).toBe(true);
    expect(isSourceTrusted(sourceById("lei-8213"))).toBe(false);
    expect(sourceInForce(sourceById("lei-8213"), TODAY)).toBe(false);
  });
  it("pins captured text bytes to the catalog SHA-256", () => {
    const captures = LEGAL_CATALOG.filter((r) => r.capture);
    expect(captures).toHaveLength(1);
    for (const record of captures) {
      const capture = record.capture!;
      const bytes = readFileSync(`docs/fontes-oficiais/${record.id}-${capture.sha256}.txt`);
      expect(bytes.length).toBe(capture.bytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(capture.sha256);
      expect(capture.identity).toBe("pendente");
      expect(record.review.status).toBe("pendente");
    }
  });
});

describe("Módulo 1 — médio", () => {
  it("keeps unreviewed engine output out of released legal conclusions", () => {
    const results = evaluate({
      referenceDate: TODAY,
      birthDate: "1950-01-01",
      householdSize: 1,
      householdMonthlyIncome: 0,
      minimumWage: 1500,
    });
    expect(results[0]?.overall).toBe("atendido"); // Existing arithmetic is unchanged.
    expect(plainReport(results).items[0]?.summary).toContain("conclusão bloqueada");
    expect(plainReport(results).items[0]?.summary).not.toContain("parece cumprido");
    expect(technicalReport(results).every((result) => result.releaseStatus === "bloqueado")).toBe(
      true,
    );
  });
  it.each(["2026-02-30", "2025-02-29", "2026-13-01", "2026-00-10", "2026-1-01", "", "<script>"])(
    "rejects invalid calendar date %s",
    (value) => {
      expect(legalDateSchema.safeParse(value).success).toBe(false);
      expect(() => readLegalLibrary({ onDate: value }, TODAY)).toThrow();
    },
  );
  it.each([
    "http://www.planalto.gov.br/",
    "https://www.planalto.gov.br.attacker.invalid/",
    "https://user:secret@www.planalto.gov.br/",
    "https://127.0.0.1/",
    "javascript:alert(1)",
    "https://www.planalto.gov.br:444/",
  ])("rejects unofficial or credential-bearing URL %s", (url) => {
    expect(isOfficialLegalUrl(url)).toBe(false);
    expect(legalRecordSchema.safeParse({ ...approvedFixture(), url }).success).toBe(false);
  });
  it("rejects wrong authority and duplicate catalog revisions", () => {
    expect(legalRecordSchema.safeParse({ ...approvedFixture(), authority: "STJ" }).success).toBe(
      false,
    );
    expect(() => validateLegalCatalog([LEGAL_CATALOG[0], LEGAL_CATALOG[0]])).toThrow();
    expect(() => validateLegalCatalog([])).toThrow();
  });
  it.each([
    { limit: 51 },
    { limit: 0 },
    { offset: -1 },
    { query: "a".repeat(121) },
    { kind: "unknown" },
    { extra: true },
  ])("rejects unsafe query %j", (input) => {
    expect(() => readLegalLibrary({ ...query, ...input }, TODAY)).toThrow();
  });
  it("does not accept empty, unknown or fabricated citations", () => {
    expect(resolveLegalCitations([], TODAY, TODAY).usable).toBe(false);
    const citation = {
      sourceId: "lei-8213",
      version: sourceById("lei-8213").version,
      reference: "art. 999999",
    };
    expect(resolveLegalCitations([citation], TODAY, TODAY).citations[0]?.blockers).toContain(
      "dispositivo_nao_catalogado",
    );
    expect(
      resolveLegalCitations([{ ...citation, version: "not-existing" }], TODAY, TODAY).usable,
    ).toBe(false);
    expect(
      isSourceTrusted({
        ...sourceById("lei-8213"),
        verification: "verificada",
        review: "aprovada",
        sha256: "a".repeat(64),
        reviewer: "invented",
      }),
    ).toBe(false);
  });
  it("invalidates mismatched hashes and incomplete reviews", () => {
    const record = approvedFixture();
    record.review.captureSha256 = "b".repeat(64);
    expect(assessLegalRecord(record, TODAY, TODAY).usable).toBe(false);
    record.review.captureSha256 = "a".repeat(64);
    record.review.reviewerReference = null;
    expect(assessLegalRecord(record, TODAY, TODAY).usable).toBe(false);
  });
  it("blocks expired reviews, future evidence, unconfirmed periods and revoked records", () => {
    const expired = approvedFixture();
    expired.review.dueOn = "2026-10-29";
    expect(assessLegalRecord(expired, TODAY, TODAY).blockers).toContain("atualizacao_pendente");
    const future = approvedFixture();
    future.review.reviewedAt = "2026-11-01T00:00:00Z";
    future.history.push({
      at: future.review.reviewedAt,
      event: "revisao",
      reason: "Synthetic future review",
    });
    expect(assessLegalRecord(future, TODAY, TODAY).blockers).toContain("revisao_futura");
    const unconfirmed = approvedFixture();
    unconfirmed.effective.verified = false;
    expect(assessLegalRecord(unconfirmed, TODAY, TODAY).usable).toBe(false);
    const revoked = approvedFixture();
    revoked.legalStatus = "revogada";
    expect(assessLegalRecord(revoked, TODAY, TODAY).usable).toBe(false);
    expect(assessLegalRecord(approvedFixture(), "2027-01-01", TODAY).blockers).toContain(
      "fora_da_vigencia",
    );
  });
  it("does not infer that an identified precedent is still applicable", () => {
    const record = structuredClone(findLegalRecord("stf-tema-350")!);
    expect(record.precedent?.caseNumber).toBe("RE 631.240");
    expect(assessLegalRecord(record, TODAY, TODAY).blockers).toContain("precedente_nao_aplicavel");
  });
  it("resets evidence and approval on a new version and preserves the original", () => {
    const previous = approvedFixture();
    const before = JSON.stringify(previous);
    const next = proposeLegalRevision(
      previous,
      "synthetic-test-v2",
      previous.url,
      "2026-10-30T00:00:00Z",
      "Synthetic update",
    );
    expect(next.revision).toBe(previous.revision + 1);
    expect(next.capture).toBeNull();
    expect(next.review.status).toBe("pendente");
    expect(next.effective.verified).toBe(false);
    expect(assessLegalRecord(next, TODAY, TODAY).usable).toBe(false);
    expect(JSON.stringify(previous)).toBe(before);
    expect(() =>
      proposeLegalRevision(
        previous,
        previous.version,
        previous.url,
        "2026-10-30T00:00:00Z",
        "same version",
      ),
    ).toThrow();
  });
  it("selects the new pending revision instead of falling back to a trusted old one", () => {
    const previous = approvedFixture();
    const next = proposeLegalRevision(
      previous,
      "synthetic-test-v2",
      previous.url,
      "2026-10-30T00:00:00Z",
      "Update",
    );
    const result = readLegalLibrary(query, TODAY, [previous, next]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.revision).toBe(2);
    expect(result.items[0]?.assessment.usable).toBe(false);
    expect(() => {
      (LEGAL_CATALOG[0]!.review as { status: string }).status = "aprovada";
    }).toThrow();
  });
  it("rejects skipped revisions and rewritten audit history", () => {
    const previous = approvedFixture();
    const next = proposeLegalRevision(
      previous,
      "synthetic-test-v2",
      previous.url,
      "2026-10-30T00:00:00Z",
      "Update",
    );
    expect(() => validateLegalCatalog([previous, { ...next, revision: 3 }])).toThrow(
      "Histórico de revisões incompleto",
    );
    next.history[0]!.reason = "rewritten";
    expect(() => validateLegalCatalog([previous, next])).toThrow(
      "Histórico anterior não pode ser reescrito",
    );
  });
});

describe("Módulo 1 — alto estresse local", () => {
  it("bounds a catalog of 5000 versions and refuses overflow", () => {
    const base = LEGAL_CATALOG[0]!;
    const records = Array.from({ length: 5000 }, (_, i) => ({ ...base, id: `synthetic-${i}` }));
    const result = readLegalLibrary({ ...query, limit: 50 }, TODAY, records);
    expect(result.total).toBe(5000);
    expect(result.items).toHaveLength(50);
    expect(() =>
      readLegalLibrary(query, TODAY, [...records, { ...base, id: "overflow" }]),
    ).toThrow();
  });
  it("keeps 200 parallel local reads deterministic and never changes review state", async () => {
    const before = JSON.stringify(LEGAL_CATALOG);
    const results = await Promise.all(
      Array.from({ length: 200 }, async () => readLegalLibrary(query, TODAY)),
    );
    expect(
      results.every(
        (result) => result.total === 9 && result.items.every((item) => !item.assessment.usable),
      ),
    ).toBe(true);
    expect(JSON.stringify(LEGAL_CATALOG)).toBe(before);
    expect(fetch).not.toHaveBeenCalled();
  });
});
