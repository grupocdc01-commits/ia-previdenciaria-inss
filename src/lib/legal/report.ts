import { sourceById } from "./sources";
import { FACT_QUESTIONS, type ModuleResult } from "./engine";
import { findLegalRecord, resolveLegalCitations } from "./catalog";
import { legalToday } from "./catalog-schema";

const PLAIN: Record<string, string> = {
  atendido: "parece cumprido",
  nao_atendido: "parece não cumprido",
  indeterminado: "ainda não dá para saber",
};

export function technicalReport(results: ModuleResult[]) {
  return results.map((m) => ({
    module: m.module,
    title: m.title,
    overall: m.overall,
    preliminary: m.preliminary,
    releaseStatus: "bloqueado" as const,
    sourcesTrusted: m.sourcesTrusted,
    caveats: m.caveats,
    requirements: m.requirements.map((r) => ({
      ...r,
      basis: r.basis.map((b) => {
        const s = sourceById(b.sourceId);
        const record = findLegalRecord(s.id, s.version);
        const today = legalToday();
        return {
          ...b,
          title: s.title,
          url: s.url,
          version: s.version,
          verification: s.verification,
          review: s.review,
          audit: record
            ? {
                revision: record.revision,
                capturedAt: record.capture?.capturedAt ?? null,
                sha256: record.capture?.sha256 ?? null,
                legalStatus: record.legalStatus,
                reviewDueOn: record.review.dueOn,
                blockers: resolveLegalCitations(
                  [{ sourceId: s.id, version: s.version, reference: b.article }],
                  m.referenceDate ?? today,
                  today,
                ).citations[0]?.blockers ?? ["fonte_desconhecida"],
              }
            : null,
        };
      }),
    })),
  }));
}

export function plainReport(results: ModuleResult[]) {
  const pending = new Set<string>();
  const items = results.map((m) => {
    m.requirements.forEach((r) =>
      r.missing?.forEach((k) => FACT_QUESTIONS[k] && pending.add(FACT_QUESTIONS[k]!)),
    );
    return {
      title: m.title,
      summary: m.sourcesTrusted
        ? `${m.title}: ${PLAIN[m.overall]} (resultado preliminar).`
        : `${m.title}: conclusão bloqueada; fontes ou dispositivos ainda não conferidos.`,
      lines: m.requirements.map((r) =>
        m.sourcesTrusted
          ? `${r.label}: ${PLAIN[r.status]}. ${r.reason}`
          : `${r.label}: aguarda conferência das referências e revisão jurídica.`,
      ),
    };
  });
  return {
    items,
    pending: [...pending],
    notice:
      "Isto é uma orientação preliminar, não uma decisão do INSS nem um parecer de advogado. As regras ainda passam por revisão jurídica.",
  };
}
