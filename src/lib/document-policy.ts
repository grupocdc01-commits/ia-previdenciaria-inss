import { z } from "zod";

export const DOCUMENT_BUCKET = "documentos-previdenciarios";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const documentKinds = {
  cnis: "O CNIS ajuda a conferir vínculos, contribuições e indicadores pendentes.",
  ctps: "A carteira de trabalho ajuda a conferir empregadores e datas dos vínculos.",
  indeferimento: "A decisão ajuda a identificar o motivo informado pelo INSS, sem presumir um prazo.",
  bpc: "CadÚnico e comprovantes ajudam a organizar a triagem do BPC/LOAS; não envie dados de terceiros desnecessários.",
  incapacidade: "Documentos pertinentes podem ajudar na triagem da incapacidade. A leitura automática de dados médicos está bloqueada nesta etapa.",
  aposentadoria: "CNIS, CTPS e PPP podem ajudar a conferir períodos para aposentadoria; nenhuma soma comprova direito por si só.",
};
export function validateDocumentBytes(bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) throw new Error("Envie um arquivo de até 10 MB.");
  const valid = mime === "application/pdf" ? new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
    : mime === "image/png" ? [137,80,78,71,13,10,26,10].every((n,i) => bytes[i] === n)
    : mime === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : false;
  if (!valid) throw new Error("Envie um PDF, JPG ou PNG válido. Outros formatos não são aceitos.");
}
export const extractionSchema = z.object({
  documentType: z.enum(["cnis", "ctps", "indeferimento", "outro", "medico"]),
  fields: z.array(z.object({
    field: z.enum(["empregador", "inicio_vinculo", "fim_vinculo", "competencia", "indicador_cnis", "data_decisao", "motivo_administrativo"]),
    value: z.string().max(500), page: z.number().int().positive(), quote: z.string().max(500),
  }).strict()).max(100),
  limitations: z.array(z.string().max(300)).max(10),
}).strict();
export function safeExtraction(input: unknown) {
  const result = extractionSchema.parse(input);
  if (result.documentType === "medico") return { ...result, fields: [], limitations: ["Leitura de dados médicos bloqueada. Revisão profissional necessária."] };
  const sensitive = /\b(?:\d{3}\.?\d{3}\.?\d{3}-?\d{2}|CID(?:-?10)?|diagn[oó]stico|laudo m[eé]dico|doen[cç]a|patologia|tratamento m[eé]dico)\b/i;
  return { ...result, fields: result.fields.filter(field => !sensitive.test(`${field.value} ${field.quote}`)),
    limitations: result.limitations.filter(text => !sensitive.test(text)) };
}
export function documentExpiry(created: string, days: number | null) {
  if (days === null) return null;
  if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error("Prazo inválido.");
  return new Date(new Date(created).getTime() + days * 86400000).toISOString();
}