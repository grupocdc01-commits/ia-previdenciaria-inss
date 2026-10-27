import { z } from 'zod';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, 'Data inválida');
export const benefitSchema = z.enum(['aposentadoria_rgps', 'incapacidade', 'bpc', 'rpps']);
export const ufSchema = z.enum(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']);
export const caseInput = z.object({
  benefit: benefitSchema,
  subtype: z.string().trim().min(1).max(100).nullable().default(null),
  uf: ufSchema,
  der: isoDate.nullable().default(null),
  noticeDate: isoDate.nullable().default(null),
  denialReason: z.string().trim().min(1).max(2000).nullable().default(null),
  syntheticData: z.literal(true),
  consent: z.literal(true)
}).strict();
export type CaseInput = z.infer<typeof caseInput>;
export type CaseRecord = CaseInput & { id: string; ownerId: string; createdAt: string; revision: number };

export const documentInput = z.object({
  name: z.string().trim().min(1).max(100).regex(/^[\p{L}\p{N} ._-]+$/u),
  mimeType: z.literal('text/plain'),
  kind: z.enum(['carta_indeferimento', 'cnis', 'ctps', 'laudo', 'outro']),
  text: z.string().trim().min(1).max(100_000)
}).strict();
export type DocumentRecord = z.infer<typeof documentInput> & {
  id: string; sha256: string; pages: string[]; createdAt: string; purgedAt?: string
};
export const factFields = ['composicao_familiar', 'renda_familiar', 'periodos_contributivos', 'documentacao_medica', 'motivo_indeferimento'] as const;
export const factInput = z.object({
  field: z.enum(factFields),
  value: z.string().trim().min(1).max(2000),
  origin: z.enum(['declarado', 'documental']),
  evidence: z.object({ documentId: z.uuid(), page: z.int().positive(), quote: z.string().trim().min(1).max(3000) }).strict().nullable().default(null)
}).strict().superRefine((fact, context) => {
  if ((fact.origin === 'documental') !== (fact.evidence !== null)) {
    context.addIssue({ code: 'custom', message: 'Fato documental exige evidência; declaração não deve simulá-la.' });
  }
});
export type Fact = z.infer<typeof factInput> & { id: string; confirmed: boolean };
export const messageInput = z.object({ field: z.enum(factFields), answer: z.string().trim().min(1).max(2000) }).strict();
export type Question = { field: string; text: string };
export type CaseState = { case: CaseRecord; documents: DocumentRecord[]; facts: Fact[]; messages: { field: string; answer: string }[] };

export const sourceSchema = z.object({
  id: z.string().min(1), version: z.string().min(1), title: z.string().min(1),
  url: z.url(), text: z.string().min(1), anchor: z.string().min(1),
  benefit: benefitSchema, validFrom: isoDate, validTo: isoDate.nullable(),
  approval: z.enum(['draft', 'approved']), legalValidityVerified: z.boolean(),
  demonstration: z.boolean(), jurisdiction: z.enum(['nacional', ...ufSchema.options]),
  authority: z.enum(['demonstracao', 'orientacao_administrativa', 'lei', 'precedente']),
  vector: z.array(z.number().finite()).min(1)
}).strict().refine(s => s.validTo === null || s.validTo >= s.validFrom, 'Vigência invertida');
export type Source = z.infer<typeof sourceSchema>;
export type Citation = { sourceId: string; version: string; url: string; anchor: string; quote: string; demonstration: boolean };
export type RuleResult = {
  id: string; version: string; result: 'atendido' | 'nao_atendido' | 'indeterminado';
  applicable: boolean; requiresReview: boolean; referenceDate: string | null;
  justification: string; evidenceIds: string[]; missing: string[]; demonstration: boolean
};
export type Analysis = {
  id: string; case_id: string; status: 'indeterminado'; mode: 'demonstracao'; created_at: string;
  resumo: string; fatos_comprovados: Fact[]; fatos_declarados: Fact[];
  motivo_indeferimento: string | null;
  hipoteses_favoraveis: { descricao: string; evidencias: string[]; provas_necessarias: string[] }[];
  fundamentos_contrarios: string[]; regras_executadas: RuleResult[]; fontes: Citation[];
  documentos_faltantes: string[]; prazos_a_verificar: string[]; proximos_passos: string[];
  limitacoes: string[]; revisao_profissional_recomendada: true;
  audit: { sourceVersions: string[]; engineVersion: string; model: 'mock-local-v1'; promptVersion: 'demo-v1'; caseRevision: number }
};

export class DomainError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) { super(message); this.statusCode = statusCode; }
}
