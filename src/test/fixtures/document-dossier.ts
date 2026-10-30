import type { Tables } from "@/integrations/supabase/types";
export const THREAD = "00000000-0000-4000-8000-000000000001";
export const DOC = "00000000-0000-4000-8000-000000000002";
export const OWNER = "00000000-0000-4000-8000-000000000003";
export const TODAY = "2026-10-30";
export const extraction = {
  documentType: "cnis",
  fields: [
    { field: "inicio_vinculo", value: "2020-01-01", page: 1, quote: "01/01/2020" },
    { field: "fim_vinculo", value: "2020-01-10", page: 1, quote: "10/01/2020" },
    {
      field: "indicador_cnis",
      value: "PENDENCIA SINTETICA",
      page: 2,
      quote: "PENDENCIA SINTETICA",
    },
  ],
  limitations: [],
};
export function fixtureDoc(
  patch: Partial<Tables<"previdenciary_documents">> = {},
): Tables<"previdenciary_documents"> {
  return {
    id: DOC,
    user_id: OWNER,
    investigation_id: THREAD,
    storage_path: `${OWNER}/${THREAD}/synthetic.pdf`,
    original_name: "documento-sintetico.pdf",
    mime_type: "application/pdf",
    byte_size: 100,
    sha256: "a".repeat(64),
    status: "needs_review",
    extraction,
    model: "synthetic-model",
    extraction_version: "administrative-v1",
    extracted_at: "2026-10-29T00:00:00Z",
    external_consent_at: null,
    created_at: "2026-10-29T00:00:00Z",
    delete_after: null,
    deletion_state: "active",
    review_revision: 1,
    administrative_review: ["confirmed", "confirmed", "pending"],
    reviewed_at: "2026-10-30T00:00:00Z",
    ...patch,
  };
}
export const selectedPeriod = {
  origin: "document_review" as const,
  documentId: DOC,
  reviewRevision: 1,
  startField: 0,
  endField: 1,
};
