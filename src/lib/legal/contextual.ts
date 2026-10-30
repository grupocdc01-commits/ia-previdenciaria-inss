// Investigação contextual: detecta fatos DECLARADOS que merecem uma pergunta
// complementar antes de avançar. Nunca preenche fatos automaticamente e nunca
// conclui direito; cada intervenção cita fontes do catálogo com seu estado real.
import type { Answers } from "../case-model";
import { z } from "zod";
import { findLegalRecord, resolveLegalCitations } from "./catalog";
import { legalToday } from "./catalog-schema";
import { sourceById } from "./sources";

export type Trabalho = "rural" | "insalubre" | "sem_registro" | "registrado" | "nunca" | "nao_sei";
export type ContextStatus = "confirmado" | "nao_sei" | "pulado";
export type ContextAnswer = {
  status: ContextStatus;
  values?: string[] | undefined;
  trigger?: string | undefined;
  step: string;
};

export type Probe = {
  id: string;
  fact: string;
  step: string;
  explanation: string;
  question: string;
  options: Record<string, string>;
  multi: boolean;
  basis: { sourceId: string; ref: string }[];
  proofCaveat: string;
};

const PROBES: Probe[] = [
  {
    id: "rural",
    fact: "Declarou trabalho rural",
    step: "trabalho",
    explanation:
      "Vamos organizar o que você declara sobre o trabalho rural. A existência de documentos ou testemunhas não confirma, por si só, o trabalho nem um direito.",
    question: "Quais destes você tem ou consegue obter sobre o trabalho rural?",
    options: {
      autodeclaracao: "Autodeclaração do segurado especial (formulário do INSS)",
      ccir_itr: "CCIR, ITR ou cadastro no INCRA da terra",
      notas_produtor: "Notas de venda da produção (bloco de produtor)",
      contrato: "Contrato de arrendamento, parceria ou comodato",
      sindicato: "Documento de sindicato rural ou cooperativa",
      testemunhas: "Pessoas que podem confirmar o trabalho (testemunhas)",
      nenhum: "Nenhum destes",
    },
    multi: true,
    basis: [
      { sourceId: "lei-8213", ref: "art. 55, §3º; art. 106" },
      { sourceId: "stj-sumula-149", ref: "Súmula 149" },
      { sourceId: "stj-tema-554", ref: "Tema 554 (boia-fria)" },
    ],
    proofCaveat:
      "Documentos da terra e testemunhas serão apenas relacionados para conferência. Não avaliamos suficiência da prova; as referências jurídicas ainda aguardam revisão.",
  },
  {
    id: "insalubre",
    fact: "Declarou trabalho com ruído, calor, química ou risco",
    step: "trabalho",
    explanation:
      "Vamos relacionar documentos sobre as condições de trabalho que você relatou. A profissão ou um documento isolado não será tratado aqui como comprovação de atividade especial.",
    question: "Você tem ou pode pedir à empresa algum destes papéis?",
    options: {
      ppp: "PPP — Perfil Profissiográfico Previdenciário",
      ltcat: "LTCAT ou laudo técnico da empresa",
      ctps: "Carteira de trabalho com a função",
      nenhum: "Nenhum destes",
    },
    multi: true,
    basis: [
      { sourceId: "lei-8213", ref: "arts. 57 e 58" },
      { sourceId: "ec-103", ref: "art. 19, §1º; art. 25, §2º" },
    ],
    proofCaveat:
      "A função anotada na carteira não comprova, sozinha, a exposição ao agente nocivo.",
  },
  {
    id: "sem_registro",
    fact: "Declarou trabalho sem carteira assinada",
    step: "trabalho",
    explanation:
      "Vamos registrar o que você informa sobre o trabalho sem carteira e quais registros existem, sem concluir reconhecimento do vínculo.",
    question: "Você tem algum papel da época desse trabalho?",
    options: {
      recibos: "Recibos, holerites ou comprovantes de pagamento",
      declaracao: "Declaração ou documento do empregador",
      fotos: "Fotos, crachás ou registros da época",
      nenhum: "Nenhum destes",
    },
    multi: true,
    basis: [{ sourceId: "lei-8213", ref: "art. 55, §3º" }],
    proofCaveat:
      "A lista apenas organiza registros declarados. O vínculo e a suficiência da documentação dependem de conferência e revisão jurídica.",
  },
  {
    id: "incapacidade",
    fact: "Benefício por incapacidade",
    step: "beneficio",
    explanation:
      "Você pode informar apenas se há limitações para trabalhar, sem descrever diagnósticos, CID ou detalhes médicos. Nenhuma resposta será tratada como avaliação pericial.",
    question: "A doença ou lesão impede você de trabalhar hoje?",
    options: {
      sim_temporario: "Sim, por um tempo",
      sim_permanente: "Sim, acho que de forma permanente",
      nao: "Não impede",
    },
    multi: false,
    basis: [{ sourceId: "lei-8213", ref: "arts. 42 e 59" }],
    proofCaveat:
      "A resposta é declarada; só perícia e documentos médicos avaliam a incapacidade. Não envie dados médicos aqui.",
  },
  {
    id: "indeferimento",
    fact: "Pedido negado pelo INSS",
    step: "situacao",
    explanation:
      "Vamos separar o motivo que você entendeu da negativa do que consta no documento. Nenhuma categoria escolhida define automaticamente recurso, prazo ou ação judicial.",
    question: "Você sabe qual foi o motivo da negativa?",
    options: {
      falta_documento: "Faltou documento ou exigência",
      pericia: "Perícia não reconheceu a incapacidade",
      tempo: "Faltou tempo de contribuição ou carência",
      renda: "Renda da família acima do limite",
    },
    multi: false,
    basis: [
      { sourceId: "lei-8213", ref: "art. 126" },
      { sourceId: "in-128", ref: "recurso administrativo" },
    ],
    proofCaveat:
      "O motivo informado aqui é declarado; a carta de decisão do INSS é o documento que comprova.",
  },
];

export type ContextInput = Pick<Answers, "beneficio" | "situacao" | "trabalhos" | "contexto">;
const statusSchema = z.enum(["confirmado", "nao_sei", "pulado"]);
const contextSchema = z
  .object({
    status: statusSchema,
    step: z.string().max(40),
    values: z.array(z.string().max(100)).max(20).optional(),
    trigger: z.string().max(100).optional(),
  })
  .strict();

function deepFreeze(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return;
  Object.values(value).forEach(deepFreeze);
  Object.freeze(value);
}
deepFreeze(PROBES);

export function probeById(id: string) {
  return PROBES.find((probe) => probe.id === id);
}
export function trabalhos(a: ContextInput): Trabalho[] {
  return (a.trabalhos ?? []).filter((value): value is Trabalho =>
    ["rural", "insalubre", "sem_registro", "registrado", "nunca", "nao_sei"].includes(value),
  );
}
function triggered(a: ContextInput, probe: Probe) {
  if (["rural", "insalubre", "sem_registro"].includes(probe.id))
    return trabalhos(a).includes(probe.id as Trabalho);
  if (probe.id === "incapacidade") return a.beneficio === "incapacidade";
  if (probe.id === "indeferimento") return a.situacao === "negado";
  return false;
}
function triggerKey(probe: Probe) {
  return `${probe.step}:${probe.id}`;
}
function validatedValues(probe: Probe, input: string[]) {
  if (
    !Array.isArray(input) ||
    !input.length ||
    input.length > Object.keys(probe.options).length ||
    new Set(input).size !== input.length ||
    input.some((value) => !Object.hasOwn(probe.options, value))
  )
    throw new Error("Selecione apenas opções válidas, sem repetição.");
  if ((!probe.multi && input.length !== 1) || (input.includes("nenhum") && input.length !== 1))
    throw new Error("As opções escolhidas são incompatíveis.");
  return Object.keys(probe.options).filter((key) => input.includes(key));
}
export function readContextAnswer(a: ContextInput, probe: Probe): ContextAnswer | undefined {
  if (!triggered(a, probe)) return undefined;
  const parsed = contextSchema.safeParse(a.contexto?.[probe.id]);
  if (
    !parsed.success ||
    parsed.data.step !== probe.step ||
    (parsed.data.trigger && parsed.data.trigger !== triggerKey(probe))
  )
    return undefined;
  const value = parsed.data;
  // Preserve the meaning of the legacy explicit "Não sei" option.
  if (
    probe.id === "indeferimento" &&
    value.status === "confirmado" &&
    value.values?.length === 1 &&
    value.values[0] === "nao_sabe"
  )
    return { status: "nao_sei", step: probe.step };
  if (value.status !== "confirmado") return { status: value.status, step: probe.step };
  try {
    return { ...value, values: validatedValues(probe, value.values ?? []) };
  } catch {
    return undefined;
  }
}
export function pendingProbes(a: ContextInput): Probe[] {
  return PROBES.filter((probe) => triggered(a, probe) && !readContextAnswer(a, probe));
}
export function probeForStep(a: ContextInput, step: string): Probe | undefined {
  return pendingProbes(a).find((probe) => probe.step === step);
}
export function pruneContext<T extends ContextInput>(a: T): T {
  const contexto: Record<string, ContextAnswer> = {};
  for (const probe of PROBES) {
    const entry = readContextAnswer(a, probe);
    if (entry) contexto[probe.id] = entry;
  }
  return { ...a, contexto };
}
export function recordProbe<T extends ContextInput>(
  a: T,
  supplied: Probe,
  status: ContextStatus,
  values: string[] = [],
): T {
  const probe = probeById(supplied.id);
  if (!probe || supplied.step !== probe.step || !triggered(a, probe))
    throw new Error("Complemento não corresponde à situação atual.");
  statusSchema.parse(status);
  const entry: ContextAnswer = {
    status,
    step: probe.step,
    trigger: triggerKey(probe),
    ...(status === "confirmado" ? { values: validatedValues(probe, values) } : {}),
  };
  return { ...a, contexto: { ...(a.contexto ?? {}), [probe.id]: entry } };
}
export function contextualTechnical(a: ContextInput) {
  return PROBES.flatMap((probe) => {
    const answer = readContextAnswer(a, probe);
    if (!answer) return [];
    return [
      {
        probe: probe.id,
        fact: probe.fact,
        answer: answer.status,
        values: (answer.values ?? []).map((key) => probe.options[key]!),
        basis: probe.basis.map((basis) => {
          const source = sourceById(basis.sourceId);
          const record = findLegalRecord(source.id, source.version);
          const audit = resolveLegalCitations(
            [{ sourceId: source.id, version: source.version, reference: basis.ref }],
            legalToday(),
            legalToday(),
          );
          return {
            ref: basis.ref,
            title: source.title,
            url: source.url,
            verification: source.verification,
            review: source.review,
            version: source.version,
            revision: record?.revision ?? null,
            usable: audit.usable,
          };
        }),
        caveat: probe.proofCaveat,
        evidence: "declarado" as const,
        rural:
          probe.id === "rural" && answer.status === "confirmado"
            ? ruralAssessment(answer.values ?? [])
            : undefined,
      },
    ];
  });
}
export function ruralAssessment(values: string[]) {
  const material = values.filter((value) =>
    ["autodeclaracao", "ccir_itr", "notas_produtor", "contrato", "sindicato"].includes(value),
  );
  const status = !material.length
    ? "sem_indicio"
    : material.length === 1 && material[0] === "ccir_itr"
      ? "indicio_isolado"
      : "indicios_a_conferir";
  return { status, testemunhas: values.includes("testemunhas"), conclusive: false as const };
}
export const PROBE_IDS: readonly string[] = Object.freeze(PROBES.map((probe) => probe.id));
