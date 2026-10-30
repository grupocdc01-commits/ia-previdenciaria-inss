import {
  BENEFITS,
  factsSchema,
  interviewActionSchema,
  responseSchema,
  type InterviewFacts,
  type InterviewResponse,
} from "./anamnesis-schema";
import {
  contextualTechnical,
  pendingProbes,
  probeById,
  pruneContext,
  recordProbe,
  type ContextInput,
  type Probe,
} from "./legal/contextual";
import { legalDateSchema, legalToday } from "./legal/catalog-schema";

export type InterviewQuestion = {
  key: string;
  label: string;
  type: "text" | "date" | "number" | "choices" | "context";
  options?: Record<string, string>;
  multi?: boolean;
  help?: string;
  probe?: Probe;
};
const situationOptions = {
  negado: "Pedido negado",
  exigencia: "Exigência de documentos",
  em_analise: "Pedido em análise",
  nao_solicitado: "Ainda não fiz o pedido",
  aprovado: "Benefício concedido",
};
const workOptions = {
  rural: "Trabalho rural, pesca ou extrativismo",
  insalubre: "Trabalho com ruído, calor, produtos químicos ou risco",
  sem_registro: "Trabalho sem carteira assinada",
  registrado: "Trabalho com registro ou contribuições por conta própria",
  nunca: "Nunca trabalhei",
};
const benefitQuestion: InterviewQuestion = {
  key: "benefit",
  label: "Qual benefício você procura ou informou no pedido?",
  type: "choices",
  options: Object.fromEntries(BENEFITS.map((benefit) => [benefit, benefit])),
};
const statusLabel = { confirmado: "Informado por você", nao_sei: "Não sei", pulado: "Pulado" };

function choice(facts: InterviewFacts, key: string) {
  const response = facts.responses[key];
  return response?.status === "confirmado" ? response.values?.[0] : undefined;
}
export function anamnesisQuestions(
  benefit: string | null,
  facts: InterviewFacts,
): InterviewQuestion[] {
  const situation = choice(facts, "situation");
  const age = facts.responses["age"];
  const child = age?.status === "confirmado" && age.value !== undefined && Number(age.value) < 18;
  return [
    {
      key: "situation",
      label: "Qual é a situação do pedido?",
      type: "choices",
      options: situationOptions,
    },
    ...(situation === "negado" || situation === "exigencia"
      ? [
          {
            key: "reason",
            label:
              "O que você entendeu da comunicação do INSS? Não copie nomes, CPF ou dados médicos.",
            type: "text" as const,
          },
        ]
      : []),
    ...(situation && situation !== "nao_solicitado"
      ? [
          {
            key: "requestDate",
            label: "Em que data você fez o pedido ao INSS?",
            type: "date" as const,
          },
        ]
      : []),
    ...(situation === "negado"
      ? [
          {
            key: "noticeDate",
            label: "Em que data você recebeu a comunicação da negativa?",
            type: "date" as const,
          },
        ]
      : []),
    { key: "age", label: "Qual é a idade da pessoa atendida, em anos?", type: "number" },
    ...(benefit === "Aposentadoria"
      ? [
          {
            key: "subtype",
            label: "Qual tipo de aposentadoria você procura?",
            type: "choices" as const,
            options: {
              rural: "Rural",
              idade: "Por idade",
              contribuicao: "Por tempo de contribuição",
              especial: "Especial",
              outro: "Outro tipo",
            },
          },
        ]
      : []),
    {
      key: "workTypes",
      label: "Quais tipos de trabalho fizeram parte da vida da pessoa?",
      type: "choices",
      options: workOptions,
      multi: true,
    },
    {
      key: "contributions",
      label:
        "Conte os períodos de trabalho ou contribuição que lembra. Não é necessário somar o tempo.",
      type: "text",
    },
    ...(benefit === "BPC/LOAS"
      ? [
          {
            key: "dailySupport",
            label: child
              ? "Que apoio a criança ou adolescente precisa no cotidiano ou na escola? Não descreva diagnósticos."
              : "Que apoio a pessoa precisa no cotidiano? Não descreva diagnósticos.",
            type: "text" as const,
          },
          {
            key: "household",
            label:
              "Quantas pessoas vivem na casa e existem rendas? Não informe nomes, CPF ou dados de terceiros.",
            type: "text" as const,
          },
        ]
      : []),
    {
      key: "documents",
      label: "Quais documentos você tem? O envio não é obrigatório.",
      type: "choices",
      multi: true,
      options: {
        cnis: "CNIS",
        ctps: "Carteira de trabalho",
        decisao: "Decisão ou comunicação do INSS",
        nenhum: "Nenhum destes",
      },
    },
    {
      key: "appeal",
      label: "Já apresentou recurso ao INSS ou processo judicial sobre esse pedido?",
      type: "choices",
      options: { sim: "Sim", nao: "Não" },
    },
    {
      key: "clarifications",
      label: "Há alguma informação que você quer acrescentar ou conferir?",
      type: "text",
    },
  ];
}
function responseFor(question: InterviewQuestion, input: unknown): InterviewResponse {
  const response = responseSchema.parse(input);
  if (response.status !== "confirmado") return response;
  if (question.options) {
    const values = response.values;
    if (
      !values ||
      response.value !== undefined ||
      new Set(values).size !== values.length ||
      values.some((value) => !Object.hasOwn(question.options!, value))
    )
      throw new Error("Selecione apenas opções válidas, sem repetição.");
    if (
      (!question.multi && values.length !== 1) ||
      ((values.includes("nenhum") || values.includes("nunca")) && values.length !== 1)
    )
      throw new Error("As opções escolhidas são incompatíveis.");
    return {
      status: "confirmado",
      values: Object.keys(question.options).filter((value) => values.includes(value)),
    };
  }
  if (!response.value || response.values) throw new Error("Informe uma resposta válida.");
  if (
    question.type === "date" &&
    (!legalDateSchema.safeParse(response.value).success || response.value > legalToday())
  )
    throw new Error("Confira a data informada; não use uma data futura.");
  if (
    question.type === "number" &&
    (!/^\d{1,3}$/.test(response.value) || Number(response.value) > 120)
  )
    throw new Error("Informe uma idade entre zero e 120 anos ou escolha Não sei.");
  return response;
}
export function contextInput(benefit: string | null, facts: InterviewFacts): ContextInput {
  const input: ContextInput = {
    contexto: facts.contexto,
    trabalhos:
      facts.responses["workTypes"]?.status === "confirmado"
        ? (facts.responses["workTypes"].values ?? [])
        : [],
  };
  if (benefit === "Benefício por incapacidade") input.beneficio = "incapacidade";
  const situation = choice(facts, "situation");
  if (situation && Object.hasOwn(situationOptions, situation))
    input.situacao = situation as NonNullable<ContextInput["situacao"]>;
  return input;
}
function probeQuestion(probe: Probe): InterviewQuestion {
  return {
    key: `context:${probe.id}`,
    label: probe.question,
    type: "context",
    options: probe.options,
    multi: probe.multi,
    help: probe.explanation,
    probe,
  };
}
export function nextAnamnesisQuestion(
  benefit: string | null,
  facts: InterviewFacts,
): InterviewQuestion | undefined {
  if (facts.storyStatus !== "complete") return undefined;
  if (!benefit) return benefitQuestion;
  const probe = pendingProbes(contextInput(benefit, facts))[0];
  return probe
    ? probeQuestion(probe)
    : anamnesisQuestions(benefit, facts).find(
        (question) => !Object.hasOwn(facts.responses, question.key),
      );
}
function reconcile(benefit: string | null, facts: InterviewFacts): InterviewFacts {
  const active = anamnesisQuestions(benefit, facts);
  const keys = new Set(["benefit", ...active.map((question) => question.key)]);
  const responses = Object.fromEntries(
    Object.entries(facts.responses).filter(([key]) => keys.has(key)),
  );
  const answers = Object.fromEntries(
    Object.entries(facts.answers).filter(([key]) => keys.has(key)),
  );
  const contexto = pruneContext(contextInput(benefit, { ...facts, responses })).contexto ?? {};
  return factsSchema.parse({ ...facts, responses, answers, contexto });
}
export function readAnamnesis(benefit: string | null, input: unknown) {
  const facts = factsSchema.parse(input);
  if (facts.interviewVersion !== 2) throw new Error("Esta investigação usa o fluxo anterior.");
  if (benefit !== null && !BENEFITS.includes(benefit as (typeof BENEFITS)[number]))
    throw new Error("Benefício cadastrado inválido.");
  const questions = [benefitQuestion, ...anamnesisQuestions(benefit, facts)];
  for (const [key, answer] of Object.entries(facts.responses)) {
    const question = questions.find((item) => item.key === key);
    if (!question) throw new Error("Resposta não corresponde à situação atual.");
    responseFor(question, answer);
  }
  const context = contextInput(benefit, facts);
  const contextual = contextualTechnical(context);
  const current = nextAnamnesisQuestion(benefit, facts) ?? null;
  const declarations = questions.flatMap((question) => {
    const response = facts.responses[question.key];
    if (!response) return [];
    return [
      {
        key: question.key,
        question: question.label,
        status: response.status,
        answer:
          response.status !== "confirmado"
            ? statusLabel[response.status]
            : (response.value ??
              response.values!.map((value) => question.options![value]).join("; ")),
        evidence: "declarado" as const,
      },
    ];
  });
  const notices: string[] = [];
  const requestDate = facts.responses["requestDate"]?.value;
  const noticeDate = facts.responses["noticeDate"]?.value;
  if (requestDate && noticeDate && noticeDate < requestDate)
    notices.push(
      "A data de ciência informada é anterior à do pedido. Confira as duas datas; nenhuma foi corrigida automaticamente.",
    );
  if (choice(facts, "subtype") === "rural" && choice(facts, "workTypes") === "nunca")
    notices.push(
      "Você informou aposentadoria rural e também Nunca trabalhei. Revise essas declarações; não tiramos uma conclusão a partir delas.",
    );
  return {
    version: 2 as const,
    phase:
      facts.storyStatus === "collecting"
        ? ("story" as const)
        : current
          ? ("questions" as const)
          : ("complete" as const),
    current,
    declarations,
    contextual,
    notices,
    missing: [
      ...questions
        .filter((question) => facts.responses[question.key]?.status !== "confirmado")
        .map((question) => ({
          question: question.label,
          status: facts.responses[question.key]?.status ?? "pendente",
        })),
      ...contextual
        .filter((item) => item.answer !== "confirmado")
        .map((item) => ({ question: probeById(item.probe)!.question, status: item.answer })),
    ],
    canConclude: false as const,
  };
}
export function applyAnamnesisTurn(benefit: string | null, input: unknown, actionInput: unknown) {
  let facts = factsSchema.parse(input);
  if (facts.interviewVersion !== 2) throw new Error("Esta investigação usa o fluxo anterior.");
  readAnamnesis(benefit, facts);
  const action = interviewActionSchema.parse(actionInput);
  let userText: string;
  if (action.kind === "story") {
    if (facts.storyStatus !== "collecting") throw new Error("O relato já foi concluído.");
    if (!action.text && (!action.finish || !facts.story.length))
      throw new Error("Conte sua história antes de concluir.");
    facts = factsSchema.parse({
      ...facts,
      story: [...facts.story, ...(action.text ? [action.text] : [])],
      storyStatus: action.finish ? "complete" : "collecting",
    });
    userText = action.text || "Concluí meu relato.";
  } else {
    if (facts.storyStatus !== "complete")
      throw new Error("Conclua o relato antes de responder às perguntas.");
    const current = nextAnamnesisQuestion(benefit, facts);
    const question =
      action.kind === "answer"
        ? current
        : action.questionId === "benefit"
          ? benefitQuestion
          : action.questionId.startsWith("context:")
            ? probeById(action.questionId.slice(8))
              ? probeQuestion(probeById(action.questionId.slice(8))!)
              : undefined
            : anamnesisQuestions(benefit, facts).find((item) => item.key === action.questionId);
    if (
      !question ||
      question.key !== action.questionId ||
      (action.kind === "revise" &&
        !Object.hasOwn(facts.responses, action.questionId) &&
        !Object.hasOwn(facts.contexto, action.questionId.slice(8)))
    )
      throw new Error("Esta pergunta não está disponível. Reabra a investigação.");
    const response = responseFor(question, action.response);
    userText = `${action.kind === "revise" ? "Correção — " : ""}${question.label}: ${response.status !== "confirmado" ? statusLabel[response.status] : (response.value ?? response.values!.map((value) => question.options![value]).join("; "))}`;
    if (question.key.startsWith("context:")) {
      facts.contexto =
        recordProbe(
          contextInput(benefit, facts),
          question.probe!,
          response.status,
          response.values ?? [],
        ).contexto ?? {};
    } else {
      if (question.key === "benefit") {
        benefit = response.status === "confirmado" ? response.values![0]! : "Não sei informar";
        if (action.kind === "revise")
          facts = { ...facts, answers: {}, responses: {}, contexto: {} };
      }
      if (action.kind === "revise" && question.key === "situation") {
        for (const key of ["reason", "requestDate", "noticeDate"]) {
          delete facts.responses[key];
          delete facts.answers[key];
        }
        delete facts.contexto["indeferimento"];
      }
      if (action.kind === "revise" && question.key === "age") {
        delete facts.responses["dailySupport"];
        delete facts.answers["dailySupport"];
      }
      facts.responses[question.key] = response;
      if (response.status === "confirmado")
        facts.answers[question.key] =
          response.value ?? response.values!.map((value) => question.options![value]).join("; ");
      else delete facts.answers[question.key];
    }
    facts = reconcile(benefit, facts);
  }
  const session = readAnamnesis(benefit, facts);
  facts.awaiting = session.current?.key ?? (session.phase === "story" ? "story" : "complete");
  const assistantText =
    session.phase === "story"
      ? "Seu trecho foi registrado. Continue no seu tempo ou confirme que terminou."
      : session.current
        ? `${session.current.help ? session.current.help + " " : ""}${session.current.label}`
        : "A coleta desta etapa terminou. Há declarações e possíveis lacunas para revisar; nenhuma conclusão jurídica foi liberada.";
  return { benefit, facts, session, userText, assistantText };
}
export function newInvestigationFacts(enabled: boolean): InterviewFacts {
  return factsSchema.parse({
    interviewVersion: enabled ? 2 : 1,
    storyStatus: "collecting",
    story: [],
  });
}
