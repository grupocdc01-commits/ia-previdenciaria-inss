import { findLegalRecord, latestLegalRecords, resolveLegalCitations } from "./catalog";
import { assessLegalRecord, legalDateSchema, legalToday } from "./catalog-schema";
import type { LegalSource } from "./source-data";

export type { LegalSource, SourceReview, SourceVerification } from "./source-data";

// Compatibility view for the preliminary engine; the catalog is the single source.
export const LEGAL_SOURCES: readonly LegalSource[] = Object.freeze(
  latestLegalRecords().map((record) =>
    Object.freeze({
      id: record.id,
      title: record.title,
      url: record.url,
      version: record.version,
      effectiveFrom: record.effective.from,
      effectiveUntil: record.effective.until,
      verification:
        record.capture?.identity === "conferida"
          ? ("verificada" as const)
          : ("nao_verificada" as const),
      sha256: record.capture?.sha256 ?? null,
      review: record.review.status === "aprovada" ? ("aprovada" as const) : ("pendente" as const),
      reviewer: record.review.reviewerReference,
    }),
  ),
);

export function sourceById(id: string) {
  const source = LEGAL_SOURCES.find((item) => item.id === id);
  if (!source) throw new Error(`Fonte desconhecida: ${id}`);
  return source;
}

export function isSourceTrusted(source: LegalSource) {
  const record = findLegalRecord(source.id, source.version);
  const today = legalToday();
  return (
    !!record &&
    source.url === record.url &&
    source.title === record.title &&
    source.effectiveFrom === record.effective.from &&
    source.effectiveUntil === record.effective.until &&
    source.sha256 === record.capture?.sha256 &&
    source.verification === "verificada" &&
    source.review === "aprovada" &&
    source.reviewer === record.review.reviewerReference &&
    assessLegalRecord(record, today, today).usable
  );
}

export function sourceInForce(source: LegalSource, onDate: string) {
  const record = findLegalRecord(source.id, source.version);
  return (
    !!record &&
    legalDateSchema.safeParse(onDate).success &&
    record.effective.verified &&
    record.legalStatus === "vigente" &&
    record.effective.from <= onDate &&
    (record.effective.until === null || onDate < record.effective.until)
  );
}

export function isCitationTrusted(sourceId: string, reference: string, onDate = legalToday()) {
  const record = findLegalRecord(sourceId);
  if (!record) return false;
  const today = legalToday();
  return resolveLegalCitations([{ sourceId, version: record.version, reference }], onDate, today)
    .usable;
}
