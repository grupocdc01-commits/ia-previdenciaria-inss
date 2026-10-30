import { z } from "zod";
import type { UIMessage } from "ai";

export const BENEFITS = [
  "Aposentadoria",
  "Benefício por incapacidade",
  "BPC/LOAS",
  "Pensão por morte",
  "Salário-maternidade",
  "Auxílio-reclusão",
  "Outro benefício",
  "Não sei informar",
] as const;
export const INSUFFICIENT = "Ainda não temos informações suficientes para concluir a investigação.";
export const STORY_OPENING =
  "Olá! Estou aqui para ajudar a entender por que seu benefício foi negado pelo INSS.\n\nVocê pode me contar sua história por áudio ou texto.\n\nFale com calma, no seu tempo. Primeiro vou ouvir tudo o que aconteceu. Depois farei algumas perguntas para investigar melhor sua situação.";
export const MODULES = BENEFITS.map((name) => ({ name, status: "not_validated" as const }));
export function canInvestigateFully(benefit: string, validated: boolean) {
  return benefit === "Aposentadoria" && validated;
}
export const factsSchema = z.object({
  answers: z.record(z.string()).default({}),
  awaiting: z.string().default("benefit"),
  documentsSkipped: z.boolean().default(false),
  storyStatus: z.enum(["collecting", "complete"]).default("complete"),
  story: z.array(z.string()).default([]),
});
export type InterviewFacts = z.infer<typeof factsSchema>;
export const textPartsSchema = z.array(z.object({ type: z.literal("text"), text: z.string() }));
export type InvestigationMessage = UIMessage;
export function messageText(message: UIMessage): string {
  return message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
}
export function parseFacts(value: unknown): InterviewFacts {
  const parsed = factsSchema.safeParse(value);
  return parsed.success ? parsed.data : factsSchema.parse({});
}
export function collectStory(facts: InterviewFacts, text: string, confirmed: boolean) {
  return {
    ...facts,
    story: [...facts.story, ...(text.trim() ? [text.trim()] : [])],
    storyStatus: confirmed ? ("complete" as const) : ("collecting" as const),
  };
}
export function canAdvanceInterview(facts: InterviewFacts, recording: boolean) {
  return facts.storyStatus === "complete" && !recording;
}
export function interviewQuestions(benefit: string | null) {
  return [
    ...(benefit === "Aposentadoria"
      ? [
          {
            key: "subtype",
            label: "Qual tipo de aposentadoria você pediu? Se não souber, pode dizer isso.",
          },
        ]
      : []),
    {
      key: "reason",
      label:
        "Qual motivo o INSS informou para negar o benefício? Pode contar com suas palavras ou dizer que não sabe.",
    },
    {
      key: "requestDate",
      label: "Em que data você fez o pedido ao INSS? Se não lembrar, pode dizer que não sabe.",
    },
    {
      key: "noticeDate",
      label: "Em que data você recebeu a decisão do INSS? Se não lembrar, pode dizer que não sabe.",
    },
    ...(["Aposentadoria", "Benefício por incapacidade"].includes(benefit ?? "")
      ? [
          {
            key: "contributions",
            label: "Conte um pouco sobre seus trabalhos e contribuições ao INSS.",
          },
        ]
      : []),
    {
      key: "documents",
      label:
        "Você tem algum documento, como a carta de indeferimento ou o CNIS? Não é obrigatório enviar agora.",
    },
    {
      key: "appeal",
      label:
        "Você já apresentou recurso ao INSS ou entrou com processo judicial sobre esse pedido?",
    },
    {
      key: "clarifications",
      label:
        "Há mais alguma informação ou dúvida que você gostaria de esclarecer sobre a negativa?",
    },
  ];
}
export function nextInterviewQuestion(benefit: string | null, facts: InterviewFacts) {
  if (!canAdvanceInterview(facts, false)) return undefined;
  return interviewQuestions(benefit).find((question) => !facts.answers[question.key]);
}
export function scopeNotice(benefit: string | null) {
  return benefit === "Aposentadoria"
    ? "A triagem de aposentadoria está disponível. A investigação jurídica completa aguarda implementação e validação das regras; ainda não há conclusão jurídica."
    : "Para este benefício, está disponível apenas a triagem preliminar. A análise especializada ainda não está disponível.";
}
