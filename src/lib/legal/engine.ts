import { isSourceTrusted, sourceById } from "./sources";
import { summarizePeriods, type WorkPeriod } from "./periods";

// Motor determinístico de requisitos. Nunca conclui elegibilidade: com regras não
// revisadas, o resultado global é sempre "preliminar".
export type Status = "atendido" | "nao_atendido" | "indeterminado";
export type Sex = "feminino" | "masculino";

export type Facts = {
  birthDate?: string;
  sex?: Sex;
  referenceDate: string; // data da análise (ISO)
  everRequested?: boolean; // já pediu ao INSS?
  denied?: boolean;
  denialReason?: string;
  householdSize?: number;
  householdMonthlyIncome?: number; // R$
  minimumWage?: number; // informado pelo backend/usuário; nunca inventado
  hasLongTermImpairment?: boolean; // impedimento ≥ 2 anos (declarado)
  workIncapacity?: "temporaria" | "permanente" | "nenhuma";
  hasMedicalEvidence?: boolean;
  insuredStatus?: boolean; // qualidade de segurado (declarada)
  accidentOrExemptDisease?: boolean;
  filiatedBeforeEC103?: boolean;
  periods?: WorkPeriod[];
};

export type Requirement = {
  id: string; label: string; status: Status; reason: string;
  basis: { sourceId: string; article: string }[]; evidence: "declarado" | "comprovado" | "ausente";
  missing?: (keyof Facts)[];
};
export type ModuleId = "bpc_idoso" | "bpc_deficiencia" | "incapacidade_temporaria" | "incapacidade_permanente" | "aposentadoria_idade";
export type ModuleResult = {
  module: ModuleId; title: string; requirements: Requirement[];
  overall: Status; preliminary: true; caveats: string[]; sourcesTrusted: boolean;
};

export function ageOn(birth: string, on: string) {
  const [by = 0, bm = 0, bd = 0] = birth.split("-").map(Number); const [y = 0, m = 0, d = 0] = on.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

const req = (r: Requirement) => r;
const unknown = (id: string, label: string, missing: (keyof Facts)[], basis: Requirement["basis"]): Requirement =>
  ({ id, label, status: "indeterminado", reason: "Faltam informações para avaliar.", basis, evidence: "ausente", missing });
const bool = (id: string, label: string, v: boolean | undefined, key: keyof Facts, basis: Requirement["basis"], yes: string, no: string): Requirement =>
  v === undefined ? unknown(id, label, [key], basis) : { id, label, status: v ? "atendido" : "nao_atendido", reason: v ? yes : no, basis, evidence: "declarado" };

function ageReq(f: Facts, min: (s?: Sex) => number | undefined, basis: Requirement["basis"], needSex = false): Requirement {
  const label = "Idade mínima";
  if (!f.birthDate || (needSex && !f.sex)) return unknown("idade", label, [!f.birthDate ? "birthDate" : "sex"], basis);
  const a = ageOn(f.birthDate, f.referenceDate); const m = min(f.sex)!;
  return { id: "idade", label, status: a >= m ? "atendido" : "nao_atendido", reason: `Idade informada ${a} anos; mínimo considerado ${m}.`, basis, evidence: "declarado" };
}

function incomeReq(f: Facts): Requirement {
  const basis = [{ sourceId: "loas", article: "art. 20, §3º" }];
  const missing = (["householdSize", "householdMonthlyIncome", "minimumWage"] as const).filter(k => f[k] === undefined || f[k] === null);
  if (missing.length || !f.householdSize) return unknown("renda", "Renda por pessoa da família", missing.length ? [...missing] : ["householdSize"], basis);
  const perCapita = f.householdMonthlyIncome! / f.householdSize; const limit = f.minimumWage! / 4;
  return { id: "renda", label: "Renda por pessoa da família", basis, evidence: "declarado",
    status: perCapita <= limit ? "atendido" : "indeterminado",
    reason: perCapita <= limit ? `Renda por pessoa R$ ${perCapita.toFixed(2)} até 1/4 do salário mínimo.`
      : `Renda por pessoa R$ ${perCapita.toFixed(2)} acima de 1/4 do salário mínimo; outros critérios de vulnerabilidade podem ser avaliados (art. 20, §11), exige análise humana.` };
}

function contributionReq(f: Facts, minMonths: number | undefined, id: string, label: string, basis: Requirement["basis"]): Requirement {
  if (minMonths === undefined) return unknown(id, label, ["sex"], basis);
  if (!f.periods?.length) return unknown(id, label, ["periods"], basis);
  const s = summarizePeriods(f.periods);
  if (s.provenMonths >= minMonths) return { id, label, basis, evidence: "comprovado", status: "atendido", reason: `${s.provenMonths} meses comprovados (sem dupla contagem); mínimo ${minMonths}.` };
  if (s.totalMonths >= minMonths) return { id, label, basis, evidence: "declarado", status: "indeterminado", reason: `${s.provenMonths} meses comprovados e ${s.totalMonths} somando os declarados; mínimo ${minMonths}. Falta comprovar períodos.` };
  return { id, label, basis, evidence: s.provenDays ? "comprovado" : "declarado", status: "nao_atendido", reason: `${s.totalMonths} meses somando tudo; mínimo considerado ${minMonths}.` };
}

function combine(rs: Requirement[]): Status {
  if (rs.some(r => r.status === "nao_atendido")) return "nao_atendido";
  if (rs.some(r => r.status === "indeterminado")) return "indeterminado";
  return "atendido";
}

const CAVEAT = "Resultado preliminar: regras ainda sem revisão jurídica humana e fontes ainda não conferidas. Não é decisão do INSS nem parecer jurídico.";

function build(module: ModuleId, title: string, requirements: Requirement[], extra: string[] = []): ModuleResult {
  const ids = [...new Set(requirements.flatMap(r => r.basis.map(b => b.sourceId)))];
  return { module, title, requirements, overall: combine(requirements), preliminary: true,
    sourcesTrusted: ids.every(id => isSourceTrusted(sourceById(id))), caveats: [CAVEAT, ...extra] };
}

export function evaluate(f: Facts): ModuleResult[] {
  const carencia12 = (): Requirement => f.accidentOrExemptDisease
    ? { id: "carencia", label: "Carência", status: "atendido", reason: "Isenção de carência informada (acidente ou doença da lista legal) — precisa ser comprovada.", basis: [{ sourceId: "lei-8213", article: "art. 26, II" }], evidence: "declarado" }
    : contributionReq(f, 12, "carencia", "Carência de 12 contribuições", [{ sourceId: "lei-8213", article: "art. 25, I" }]);
  const segurado = bool("qualidade", "Qualidade de segurado", f.insuredStatus, "insuredStatus", [{ sourceId: "lei-8213", article: "art. 15" }], "Informou estar contribuindo ou dentro do período de graça.", "Informou não ter qualidade de segurado.");
  const medical = bool("prova_medica", "Documentos médicos", f.hasMedicalEvidence, "hasMedicalEvidence", [{ sourceId: "lei-8213", article: "art. 42 e 59" }], "Informou possuir laudos (perícia do INSS decide).", "Sem documentos médicos informados.");
  const incap = (kind: "temporaria" | "permanente") => f.workIncapacity === undefined
    ? unknown("incapacidade", "Incapacidade para o trabalho", ["workIncapacity"], [{ sourceId: "lei-8213", article: kind === "temporaria" ? "art. 59" : "art. 42" }])
    : { id: "incapacidade", label: "Incapacidade para o trabalho", evidence: "declarado" as const, basis: [{ sourceId: "lei-8213", article: kind === "temporaria" ? "art. 59" : "art. 42" }],
        status: (f.workIncapacity === kind ? "indeterminado" : f.workIncapacity === "nenhuma" ? "nao_atendido" : "indeterminado") as Status,
        reason: f.workIncapacity === "nenhuma" ? "Informou não ter incapacidade." : "Incapacidade declarada; só a perícia médica pode reconhecer." };

  const newRules = f.filiatedBeforeEC103 === false;
  const minContrib = f.sex === "feminino" ? 180 : f.sex === "masculino" ? (newRules ? 240 : f.filiatedBeforeEC103 ? 180 : undefined) : undefined;

  const denialCaveat = f.denied ? [`Pedido indeferido${f.denialReason ? ` (motivo informado: ${f.denialReason})` : ""}: confira o prazo de recurso na carta do INSS.`] : [];
  const neverCaveat = f.everRequested === false ? ["Você ainda não fez o pedido; a análise indica o que reunir antes de pedir."] : [];
  const ex = [...denialCaveat, ...neverCaveat];

  return [
    build("bpc_idoso", "BPC/LOAS — pessoa idosa", [ageReq(f, () => 65, [{ sourceId: "loas", article: "art. 20, caput" }]), incomeReq(f)], ex),
    build("bpc_deficiencia", "BPC/LOAS — pessoa com deficiência", [
      bool("impedimento", "Impedimento de longo prazo (2 anos ou mais)", f.hasLongTermImpairment, "hasLongTermImpairment", [{ sourceId: "loas", article: "art. 20, §§2º e 10" }], "Declarado; depende de avaliação médica e social do INSS.", "Não declarou impedimento de longo prazo."),
      incomeReq(f)], ex),
    build("incapacidade_temporaria", "Auxílio por incapacidade temporária", [incap("temporaria"), segurado, carencia12(), medical], ex),
    build("incapacidade_permanente", "Aposentadoria por incapacidade permanente", [incap("permanente"), segurado, carencia12(), medical], ex),
    build("aposentadoria_idade", "Aposentadoria por idade (regra geral/transição)", [
      ageReq(f, s => (s === "feminino" ? 62 : 65), [{ sourceId: "ec-103", article: "art. 18 e 19" }], true),
      f.sex === "masculino" && f.filiatedBeforeEC103 === undefined
        ? unknown("contribuicao", "Tempo de contribuição", ["filiatedBeforeEC103"], [{ sourceId: "ec-103", article: "art. 18 e 19" }])
        : contributionReq(f, minContrib, "contribuicao", "Tempo de contribuição", [{ sourceId: "ec-103", article: "art. 18 e 19" }, { sourceId: "lei-8213", article: "art. 25, II e 48" }]),
    ], [...ex, "Regras de transição (pontos, pedágio) ainda não implementadas."]),
  ];
}

// Pergunta adaptativa: próximo fato faltante mais útil, sem exigir CNIS/CTPS.
export const FACT_QUESTIONS: Partial<Record<keyof Facts, string>> = {
  everRequested: "Você já fez algum pedido de benefício ao INSS?",
  birthDate: "Qual é a sua data de nascimento?",
  sex: "Para as regras de aposentadoria, qual sexo consta nos seus documentos?",
  workIncapacity: "Hoje você consegue trabalhar? (sim / não por um tempo / não de forma permanente)",
  insuredStatus: "Você contribuiu para o INSS nos últimos 12 meses ou trabalhou de carteira assinada nesse período?",
  hasMedicalEvidence: "Você tem laudos, atestados ou exames que mostram seu problema de saúde?",
  hasLongTermImpairment: "Você tem alguma condição de saúde ou deficiência que dura (ou deve durar) 2 anos ou mais?",
  householdSize: "Quantas pessoas moram com você, contando você?",
  householdMonthlyIncome: "Somando todos da casa, qual é a renda por mês?",
  periods: "Conte os períodos em que trabalhou ou contribuiu (pode ser aproximado; documentos são opcionais).",
  filiatedBeforeEC103: "Você já tinha contribuído para o INSS antes de 13/11/2019?",
};

export function nextQuestion(f: Facts): { fact: keyof Facts; question: string } | undefined {
  if (f.everRequested === undefined) return { fact: "everRequested", question: FACT_QUESTIONS.everRequested! };
  const counts = new Map<keyof Facts, number>();
  for (const m of evaluate(f)) for (const r of m.requirements) for (const k of r.missing ?? []) if (k !== "minimumWage") counts.set(k, (counts.get(k) ?? 0) + 1);
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best && FACT_QUESTIONS[best[0]] ? { fact: best[0], question: FACT_QUESTIONS[best[0]]! } : undefined;
}
