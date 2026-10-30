import { unionPeriodDays } from "@/lib/legal-registry";

// Períodos informados pela pessoa ("declarado") ou lidos de documento revisado ("comprovado").
export type PeriodOrigin = "declarado" | "comprovado";
export type WorkPeriod = {
  start: string;
  end: string;
  origin: PeriodOrigin;
  label?: string;
  documentId?: string;
};

const DAY = 86_400_000;
export function toDay(iso: string) {
  const t = Date.parse(iso + "T00:00:00Z");
  if (Number.isNaN(t)) throw new Error(`Data inválida: ${iso}`);
  return Math.floor(t / DAY);
}

export type PeriodSummary = {
  provenDays: number;
  declaredOnlyDays: number; // declarado e não coberto por comprovado
  totalDays: number; // união sem dupla contagem
  overlapsRemovedDays: number;
  provenMonths: number;
  totalMonths: number;
};

// Aproximação neutra em meses de 30 dias; não substitui contagem oficial de carência por competência.
export function summarizePeriods(periods: WorkPeriod[]): PeriodSummary {
  const toRange = (p: WorkPeriod) => ({ start: toDay(p.start), end: toDay(p.end) });
  const proven = periods.filter((p) => p.origin === "comprovado").map(toRange);
  const all = periods.map(toRange);
  const provenDays = unionPeriodDays(proven);
  const totalDays = unionPeriodDays(all);
  const raw = all.reduce((s, r) => {
    if (r.end < r.start) throw new Error("Período inválido.");
    return s + r.end - r.start + 1;
  }, 0);
  return {
    provenDays,
    totalDays,
    declaredOnlyDays: totalDays - provenDays,
    overlapsRemovedDays: raw - totalDays,
    provenMonths: Math.floor(provenDays / 30),
    totalMonths: Math.floor(totalDays / 30),
  };
}
