// Official source candidates are references, not approved executable rules.
export const officialSourceCandidates = [
  {
    key: "lei-8213",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm",
    status: "pending_human_review",
  },
  {
    key: "loas",
    url: "https://www.planalto.gov.br/ccivil_03/leis/l8742.htm",
    status: "pending_human_review",
  },
  {
    key: "ec-103",
    url: "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm",
    status: "pending_human_review",
  },
] as const;
export type VerifiedPeriod = { start: number; end: number };
// Neutral interval arithmetic only. Not contribution time, carência, or eligibility.
export function unionPeriodDays(periods: VerifiedPeriod[]) {
  const sorted = periods
    .map((p) => {
      if (!Number.isInteger(p.start) || !Number.isInteger(p.end) || p.end < p.start)
        throw new Error("Período inválido.");
      return { ...p };
    })
    .sort((a, b) => a.start - b.start);
  let total = 0;
  let current: VerifiedPeriod | undefined;
  for (const next of sorted) {
    if (!current) current = next;
    else if (next.start <= current.end + 1) current.end = Math.max(current.end, next.end);
    else {
      total += current.end - current.start + 1;
      current = next;
    }
  }
  return total + (current ? current.end - current.start + 1 : 0);
}
export function requireReleasedLegalRule(rule: {
  status: string;
  executable_spec: unknown;
  reviewer_reference: string | null;
  reviewed_at: string | null;
  source_sha256: string | null;
}) {
  if (
    rule.status !== "validated" ||
    !rule.executable_spec ||
    !rule.reviewer_reference ||
    !rule.reviewed_at ||
    !rule.source_sha256
  )
    throw new Error("Regra jurídica sem validação rastreável. Cálculo especializado bloqueado.");
}
