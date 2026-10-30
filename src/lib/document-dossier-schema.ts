import { z } from "zod";

// Calendar dates only; Date.parse alone silently normalizes dates such as February 30.
export const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Data de calendário inválida.");
export const decisionSchema = z.enum(["pending", "confirmed", "rejected"]);
export const reviewDecisionsSchema = z.array(decisionSchema).max(100);
export const reviewRequestSchema = z
  .object({
    operation: z.literal("review"),
    documentId: z.string().uuid(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    extractionVersion: z.string().min(1).max(100),
    expectedRevision: z.number().int().min(0).max(2147483646),
    decisions: reviewDecisionsSchema,
  })
  .strict();
const declared = z
  .object({
    origin: z.literal("declared"),
    start: calendarDate,
    end: calendarDate,
  })
  .strict();
const documentPeriod = z
  .object({
    origin: z.literal("document_review"),
    documentId: z.string().uuid(),
    reviewRevision: z.number().int().positive(),
    startField: z.number().int().min(0).max(99),
    endField: z.number().int().min(0).max(99),
  })
  .strict();
export const dossierRequestSchema = z
  .object({
    operation: z.literal("dossier"),
    threadId: z.string().uuid(),
    periods: z.array(z.discriminatedUnion("origin", [declared, documentPeriod])).max(500),
  })
  .strict();
export const documentModuleRequestSchema = z.discriminatedUnion("operation", [
  reviewRequestSchema,
  dossierRequestSchema,
]);
export type DossierRequest = z.infer<typeof dossierRequestSchema>;
export type ReviewRequest = z.infer<typeof reviewRequestSchema>;
export type ReviewDecision = z.infer<typeof decisionSchema>;
