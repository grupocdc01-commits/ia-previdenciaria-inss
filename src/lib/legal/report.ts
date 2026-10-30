import { sourceById } from "./sources";
import { FACT_QUESTIONS, type ModuleResult } from "./engine";

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
    sourcesTrusted: m.sourcesTrusted,
    caveats: m.caveats,
    requirements: m.requirements.map((r) => ({
      ...r,
      basis: r.basis.map((b) => {
        const s = sourceById(b.sourceId);
        return {
          ...b,
          title: s.title,
          url: s.url,
          version: s.version,
          verification: s.verification,
          review: s.review,
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
      summary: `${m.title}: ${PLAIN[m.overall]} (resultado preliminar).`,
      lines: m.requirements.map((r) => `${r.label}: ${PLAIN[r.status]}. ${r.reason}`),
    };
  });
  return {
    items,
    pending: [...pending],
    notice:
      "Isto é uma orientação preliminar, não uma decisão do INSS nem um parecer de advogado. As regras ainda passam por revisão jurídica.",
  };
}
