import { z } from "zod";

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
export const responseSchema = z
  .object({
    status: z.enum(["confirmado", "nao_sei", "pulado"]),
    value: z.string().trim().min(1).max(4000).optional(),
    values: z.array(z.string().min(1).max(100)).min(1).max(20).optional(),
  })
  .strict()
  .superRefine((answer, ctx) => {
    const count = Number(answer.value !== undefined) + Number(answer.values !== undefined);
    if (
      (answer.status === "confirmado" && count !== 1) ||
      (answer.status !== "confirmado" && count !== 0)
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Confirme uma resposta ou indique desconhecimento/omissão sem valores.",
      });
  });
export type InterviewResponse = z.infer<typeof responseSchema>;
const contextEntry = z
  .object({
    status: z.enum(["confirmado", "nao_sei", "pulado"]),
    step: z.string().max(40),
    values: z.array(z.string().max(100)).max(20).optional(),
    trigger: z.string().max(100).optional(),
  })
  .strict();
const baseFactsSchema = z
  .object({
    interviewVersion: z.union([z.literal(1), z.literal(2)]).default(1),
    answers: z
      .record(z.string().max(4000))
      .refine((entries) => Object.keys(entries).length <= 30)
      .default({}),
    responses: z
      .record(responseSchema)
      .refine((entries) => Object.keys(entries).length <= 30)
      .default({}),
    contexto: z
      .record(contextEntry)
      .refine((entries) => Object.keys(entries).length <= 10)
      .default({}),
    awaiting: z.string().max(80).default("benefit"),
    documentsSkipped: z.boolean().default(false),
    storyStatus: z.enum(["collecting", "complete"]).default("complete"),
    story: z.array(z.string().max(4000)).max(100).default([]),
  })
  .strict()
  .superRefine((facts, ctx) => {
    if (
      facts.interviewVersion === 2 &&
      ((facts.storyStatus === "complete" && !facts.story.some((chunk) => chunk.trim())) ||
        facts.story.some((chunk) => !chunk.trim()))
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Relato estruturado inconsistente; não presumir conclusão da coleta.",
      });
  });
export const factsSchema = z.preprocess((input) => {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    const record = input as Record<string, unknown>;
    if (record["interviewVersion"] === 2 && !Object.hasOwn(record, "storyStatus"))
      return { ...record, storyStatus: "collecting" };
  }
  return input;
}, baseFactsSchema);
export type InterviewFacts = z.infer<typeof factsSchema>;
export function parseInterviewFacts(value: unknown): InterviewFacts {
  return factsSchema.parse(value);
}

const questionId = z
  .string()
  .regex(/^(?:[a-zA-Z][a-zA-Z0-9]*|context:[a-z_]+)$/)
  .max(80);
export const interviewActionSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("story"), text: z.string().trim().max(4000), finish: z.boolean() })
    .strict(),
  z.object({ kind: z.literal("answer"), questionId, response: responseSchema }).strict(),
  z.object({ kind: z.literal("revise"), questionId, response: responseSchema }).strict(),
]);
export type InterviewAction = z.infer<typeof interviewActionSchema>;
export const interviewRequestSchema = z
  .object({
    threadId: z.string().uuid(),
    requestId: z.string().uuid(),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    action: interviewActionSchema,
  })
  .strict();
export type InterviewRequest = z.infer<typeof interviewRequestSchema>;
