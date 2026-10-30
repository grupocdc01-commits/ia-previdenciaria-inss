// Investigação contextual: detecta fatos DECLARADOS que merecem uma pergunta
// complementar antes de avançar. Nunca preenche fatos automaticamente e nunca
// conclui direito; cada intervenção cita fontes do catálogo com seu estado real.
import type { Answers } from "../case-model";
import { sourceById } from "./sources";

export type Trabalho = "rural" | "insalubre" | "sem_registro" | "registrado" | "nunca" | "nao_sei";
export type ContextStatus = "confirmado" | "nao_sei" | "pulado";
export type ContextAnswer = {
  status: ContextStatus;
  values?: string[];
  note?: string;
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
      "Trabalho na roça pode contar para a aposentadoria, mas o INSS pede indícios de que o trabalho aconteceu. Nenhum papel sozinho resolve; o conjunto é que conta.",
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
      "Documento da terra em nome de outra pessoa ou só testemunhas não bastam isoladamente; a prova testemunhal precisa de início de prova material (Súmula 149 STJ — situação do precedente ainda não conferida no sistema).",
  },
  {
    id: "insalubre",
    fact: "Declarou trabalho com ruído, calor, química ou risco",
    step: "trabalho",
    explanation:
      "Trabalho com risco à saúde pode dar direito a contar tempo de forma especial. Isso depende de formulários da empresa, não só da profissão.",
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
      "Trabalho sem registro pode ser reconhecido, mas precisa de algum documento da época além de testemunhas.",
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
      "Prova exclusivamente testemunhal não basta para tempo de serviço, salvo força maior ou caso fortuito (art. 55, §3º — texto ainda não conferido no sistema).",
  },
  {
    id: "incapacidade",
    fact: "Benefício por incapacidade",
    step: "beneficio",
    explanation:
      "Ter uma doença não basta: o INSS avalia se ela impede o trabalho e por quanto tempo, na perícia.",
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
      "O motivo escrito na carta de negativa define o que fazer: corrigir documentos, recorrer no INSS ou, em alguns casos, buscar orientação jurídica.",
    question: "Você sabe qual foi o motivo da negativa?",
    options: {
      falta_documento: "Faltou documento ou exigência",
      pericia: "Perícia não reconheceu a incapacidade",
      tempo: "Faltou tempo de contribuição ou carência",
      renda: "Renda da família acima do limite",
      nao_sabe: "Não sei o motivo",
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

export function trabalhos(a: Answers): Trabalho[] {
  return (a.trabalhos ?? []) as Trabalho[];
}

function triggered(a: Answers, p: Probe) {
  if (p.id === "rural" || p.id === "insalubre" || p.id === "sem_registro")
    return trabalhos(a).includes(p.id as Trabalho);
  if (p.id === "incapacidade") return a.beneficio === "incapacidade";
  if (p.id === "indeferimento") return a.situacao === "negado";
  return false;
}

/** Próxima intervenção para a etapa: no máximo uma por etapa e nunca repetida. */
export function probeForStep(a: Answers, step: string): Probe | undefined {
  const ctx = a.contexto ?? {};
  if (Object.values(ctx).some((c) => c.step === step)) return undefined;
  return PROBES.find((p) => p.step === step && !ctx[p.id] && triggered(a, p));
}

/** Registra a resposta do usuário. Só grava o que ele escolheu; "pular" grava sem valores. */
export function recordProbe(
  a: Answers,
  p: Probe,
  status: ContextStatus,
  values: string[] = [],
): Answers {
  const entry: ContextAnswer = {
    status,
    step: p.step,
    ...(status === "confirmado" ? { values: [...values] } : {}),
  };
  return { ...a, contexto: { ...(a.contexto ?? {}), [p.id]: entry } };
}

/** Parte técnica do relatório: fato, fonte oficial, situação, ressalvas e prova. */
export function contextualTechnical(a: Answers) {
  const ctx = a.contexto ?? {};
  return PROBES.filter((p) => ctx[p.id]).map((p) => {
    const c = ctx[p.id]!;
    const rural = p.id === "rural" ? ruralAssessment(c.values ?? []) : undefined;
    return {
      probe: p.id,
      fact: p.fact,
      answer: c.status,
      values: (c.values ?? []).map((v) => p.options[v] ?? v),
      basis: p.basis.map((b) => {
        const s = sourceById(b.sourceId);
        return {
          ref: b.ref,
          title: s.title,
          url: s.url,
          verification: s.verification,
          review: s.review,
        };
      }),
      caveat: p.proofCaveat,
      evidence: "declarado" as const,
      rural,
    };
  });
}

/** Avaliação neutra: aponta se HÁ indício material declarado; nunca conclui prova suficiente. */
export function ruralAssessment(values: string[]) {
  const material = values.filter((v) =>
    ["autodeclaracao", "ccir_itr", "notas_produtor", "contrato", "sindicato"].includes(v),
  );
  const testemunhas = values.includes("testemunhas");
  const onlyLand = material.length === 1 && material[0] === "ccir_itr";
  let status: "sem_indicio" | "indicio_isolado" | "indicios_a_conferir";
  if (!material.length) status = "sem_indicio";
  else if (onlyLand) status = "indicio_isolado";
  else status = "indicios_a_conferir";
  return { status, testemunhas, conclusive: false as const };
}

export const PROBE_IDS = PROBES.map((p) => p.id);
