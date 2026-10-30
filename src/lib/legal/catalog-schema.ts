import { z } from "zod";

export function legalToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const legalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Data de calendário inválida.");

const OFFICIAL_HOSTS = new Set([
  "www.planalto.gov.br",
  "www.in.gov.br",
  "portal.stf.jus.br",
  "www.stj.jus.br",
  "processo.stj.jus.br",
  "scon.stj.jus.br",
]);
export function isOfficialLegalUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      OFFICIAL_HOSTS.has(url.hostname)
    );
  } catch {
    return false;
  }
}
export const officialLegalUrlSchema = z
  .string()
  .url()
  .refine(isOfficialLegalUrl, "Endereço oficial HTTPS obrigatório.");
const text = z.string().trim().min(1).max(2000);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().datetime();

export const legalRecordSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(100),
    version: text,
    revision: z.number().int().positive(),
    kind: z.enum(["legislacao", "jurisprudencia"]),
    title: text,
    authority: z.enum(["Planalto", "DOU", "STF", "STJ"]),
    url: officialLegalUrlSchema,
    references: z.array(text).min(1).max(100),
    effective: z
      .object({ from: legalDateSchema, until: legalDateSchema.nullable(), verified: z.boolean() })
      .strict(),
    legalStatus: z.enum(["nao_conferida", "vigente", "revogada", "superada", "suspensa"]),
    precedent: z
      .object({
        court: z.enum(["STF", "STJ"]),
        category: z.enum(["tema", "sumula"]),
        number: z.string().regex(/^\d+$/),
        caseNumber: text.nullable(),
        documentUrl: officialLegalUrlSchema.nullable(),
        status: z.enum(["nao_conferido", "aplicavel", "superado", "suspenso"]),
        scopeNote: text.nullable(),
      })
      .strict()
      .nullable(),
    capture: z
      .object({
        sha256,
        capturedAt: timestamp,
        finalUrl: officialLegalUrlSchema,
        bytes: z
          .number()
          .int()
          .positive()
          .max(5 * 1024 * 1024),
        identity: z.enum(["pendente", "conferida"]),
        format: z.enum(["texto-dou-v1", "texto-oficial-v1"]),
      })
      .strict()
      .nullable(),
    review: z
      .object({
        status: z.enum(["pendente", "aprovada", "rejeitada"]),
        reviewerReference: text.nullable(),
        reviewedAt: timestamp.nullable(),
        captureSha256: sha256.nullable(),
        dueOn: legalDateSchema.nullable(),
        note: text.nullable(),
      })
      .strict(),
    history: z
      .array(
        z
          .object({
            at: timestamp,
            event: z.enum(["cadastro", "nova_versao", "captura", "revisao"]),
            reason: text,
          })
          .strict(),
      )
      .min(1)
      .max(300),
  })
  .strict()
  .superRefine((record, ctx) => {
    const invalid = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (record.effective.until && record.effective.until <= record.effective.from)
      invalid("Intervalo de vigência inválido.");
    if ((record.kind === "jurisprudencia") !== (record.precedent !== null))
      invalid("Jurisprudência exige identificação do precedente.");
    if (record.precedent && record.precedent.court !== record.authority)
      invalid("Tribunal e autoridade divergentes.");
    const hosts: Record<string, string[]> = {
      Planalto: ["www.planalto.gov.br"],
      DOU: ["www.in.gov.br"],
      STF: ["portal.stf.jus.br"],
      STJ: ["www.stj.jus.br", "processo.stj.jus.br", "scon.stj.jus.br"],
    };
    for (const url of [record.url, record.capture?.finalUrl, record.precedent?.documentUrl].filter(
      (s): s is string => !!s,
    )) {
      if (isOfficialLegalUrl(url) && !hosts[record.authority]?.includes(new URL(url).hostname))
        invalid("Fonte não pertence à autoridade declarada.");
    }
    if (record.review.status === "aprovada") {
      if (
        !record.capture ||
        record.capture.identity !== "conferida" ||
        record.review.captureSha256 !== record.capture.sha256
      )
        invalid("Revisão exige captura identificada e hash correspondente.");
      if (
        !record.review.reviewerReference ||
        !record.review.reviewedAt ||
        !record.review.dueOn ||
        !record.review.note
      )
        invalid("Revisão exige responsável, data, prazo e escopo registrado.");
      if (
        record.capture &&
        record.review.reviewedAt &&
        record.review.reviewedAt < record.capture.capturedAt
      )
        invalid("Revisão anterior à captura.");
      if (
        record.review.dueOn &&
        record.review.reviewedAt &&
        record.review.dueOn < record.review.reviewedAt.slice(0, 10)
      )
        invalid("Prazo de revisão inválido.");
      if (
        !record.history.some(
          (event) => event.event === "revisao" && event.at === record.review.reviewedAt,
        )
      )
        invalid("Revisão sem evento correspondente no histórico.");
    }
  });
export type LegalRecord = z.infer<typeof legalRecordSchema>;

export const libraryQuerySchema = z
  .object({
    query: z.string().trim().max(120).default(""),
    kind: z.enum(["todas", "legislacao", "jurisprudencia"]).default("todas"),
    onDate: legalDateSchema,
    offset: z.number().int().min(0).max(1000000).default(0),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();

export function assessLegalRecord(input: unknown, onDate: string, checkedOn: string) {
  const parsed = legalRecordSchema.safeParse(input);
  if (
    !parsed.success ||
    !legalDateSchema.safeParse(onDate).success ||
    !legalDateSchema.safeParse(checkedOn).success
  ) {
    return { usable: false, blockers: ["registro_ou_data_invalida"] };
  }
  const record = parsed.data;
  const blockers: string[] = [];
  if (onDate > checkedOn) blockers.push("data_referencia_futura");
  if (!record.capture) blockers.push("captura_ausente");
  else {
    if (record.capture.identity !== "conferida") blockers.push("identidade_nao_conferida");
    if (record.capture.capturedAt.slice(0, 10) > checkedOn) blockers.push("captura_futura");
  }
  if (record.review.status !== "aprovada") blockers.push("revisao_nao_aprovada");
  if (record.review.reviewedAt && record.review.reviewedAt.slice(0, 10) > checkedOn)
    blockers.push("revisao_futura");
  if (!record.review.dueOn || record.review.dueOn < checkedOn)
    blockers.push("atualizacao_pendente");
  if (!record.effective.verified) blockers.push("vigencia_nao_conferida");
  if (record.legalStatus !== "vigente") blockers.push("situacao_nao_aplicavel");
  if (
    onDate < record.effective.from ||
    (record.effective.until && onDate >= record.effective.until)
  )
    blockers.push("fora_da_vigencia");
  if (
    record.precedent &&
    (record.precedent.status !== "aplicavel" ||
      !record.precedent.scopeNote ||
      !record.precedent.documentUrl ||
      record.precedent.documentUrl !== record.capture?.finalUrl ||
      (record.precedent.category === "tema" && !record.precedent.caseNumber))
  )
    blockers.push("precedente_nao_aplicavel");
  return { usable: blockers.length === 0, blockers };
}

export function proposeLegalRevision(
  previous: LegalRecord,
  version: string,
  url: string,
  at: string,
  reason: string,
): LegalRecord {
  const original = legalRecordSchema.parse(previous);
  if (version.trim() === original.version) throw new Error("Uma atualização exige nova versão.");
  return legalRecordSchema.parse({
    ...original,
    version,
    url,
    revision: original.revision + 1,
    capture: null,
    legalStatus: "nao_conferida",
    effective: { ...original.effective, verified: false },
    precedent: original.precedent
      ? { ...original.precedent, status: "nao_conferido", scopeNote: null }
      : null,
    review: {
      status: "pendente",
      reviewerReference: null,
      reviewedAt: null,
      captureSha256: null,
      dueOn: null,
      note: null,
    },
    history: [...original.history, { at, event: "nova_versao", reason }],
  });
}
