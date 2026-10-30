import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/integrations/supabase/types";
import { safeExtraction, extractionSchema } from "@/lib/document-policy";
import {
  dossierRequestSchema,
  documentModuleRequestSchema,
  reviewDecisionsSchema,
  calendarDate,
  type DossierRequest,
} from "@/lib/document-dossier-schema";
import { unionPeriodDays } from "@/lib/legal-registry";
import { latestLegalRecords } from "@/lib/legal/catalog";
import { legalToday } from "@/lib/legal/catalog-schema";

type Document = Tables<"previdenciary_documents">;
type Auth = { userId: string; client: SupabaseClient<Database> };
export const documentJson = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const active = (doc: Document, now: number) =>
  doc.deletion_state === "active" && (!doc.delete_after || Date.parse(doc.delete_after) > now);

// No legal rules run here. Confirmed means the owner compared a literal field, never proof.
export function buildDocumentDossier(
  input: DossierRequest,
  documents: Document[],
  today = legalToday(),
  now = Date.now(),
) {
  input = dossierRequestSchema.parse(input);
  documents = documents.filter(
    (doc) => doc.investigation_id === input.threadId && active(doc, now),
  );
  const reference = calendarDate.parse(today);
  const indexed = new Map(documents.map((doc) => [doc.id, doc]));
  const periods = input.periods.map((period) => {
    if (period.origin === "declared") return { ...period, legallyProven: false as const };
    const doc = indexed.get(period.documentId);
    if (!doc || !active(doc, now) || doc.review_revision !== period.reviewRevision)
      throw new Error("Documento ou revisão indisponível. Atualize a lista.");
    const extraction = safeExtraction(doc.extraction);
    const review = reviewDecisionsSchema.parse(doc.administrative_review);
    const start = extraction.fields[period.startField];
    const end = extraction.fields[period.endField];
    if (
      extraction.documentType === "medico" ||
      review.length !== extraction.fields.length ||
      review[period.startField] !== "confirmed" ||
      review[period.endField] !== "confirmed" ||
      start?.field !== "inicio_vinculo" ||
      end?.field !== "fim_vinculo"
    )
      throw new Error("Confira as duas datas no documento antes de selecionar o período.");
    return {
      ...period,
      start: calendarDate.parse(start.value),
      end: calendarDate.parse(end.value),
      sha256: doc.sha256,
      extractionVersion: doc.extraction_version,
      pages: [start.page, end.page],
      legallyProven: false as const,
    };
  });
  const ranges = periods.map((period) => {
    if (period.start < "1900-01-01" || period.end > reference || period.start > period.end)
      throw new Error("Informe períodos válidos, desde 1900 e sem datas futuras.");
    return {
      start: Date.parse(`${period.start}T00:00:00Z`) / 86400000,
      end: Date.parse(`${period.end}T00:00:00Z`) / 86400000,
    };
  });
  const unionDays = unionPeriodDays(ranges);
  const reviewedDays = unionPeriodDays(
    ranges.filter((_, i) => periods[i]!.origin === "document_review"),
  );
  const raw = ranges.reduce((sum, range) => sum + range.end - range.start + 1, 0);
  const reviewed = documents.flatMap((doc) => {
    if (!active(doc, now) || !doc.extraction) return [];
    const extraction = safeExtraction(doc.extraction);
    const parsed = reviewDecisionsSchema.safeParse(doc.administrative_review);
    const decisions =
      parsed.success && parsed.data.length === extraction.fields.length ? parsed.data : [];
    return [
      {
        documentId: doc.id,
        documentType: extraction.documentType,
        revision: doc.review_revision,
        confirmed: decisions.filter((d) => d === "confirmed").length,
        rejected: decisions.filter((d) => d === "rejected").length,
        pending: extraction.fields.length - decisions.filter((d) => d !== "pending").length,
      },
    ];
  });
  const gaps = [
    "Autenticidade, indicadores do CNIS e valor probatório dependem de conferência profissional.",
    "Carência por competência, filiação, qualidade de segurado e regras especiais não foram calculadas.",
  ];
  if (!documents.length)
    gaps.push(
      "Nenhum novo documento disponível; CNIS e CTPS continuam opcionais. Anexos antigos não foram analisados.",
    );
  if (!periods.length)
    gaps.push(
      "Nenhum período selecionado; zero intervalos não significa ausência de contribuição.",
    );
  if (periods.some((p) => p.origin === "declared"))
    gaps.push("Há períodos apenas declarados, sem conferência documental neste relatório.");
  if (reviewed.some((doc) => doc.pending))
    gaps.push("Há sugestões extraídas ainda pendentes de conferência.");
  const divergences: string[] = [];
  let totalOverlaps = 0;
  for (let i = 0; i < periods.length; i++) {
    for (let j = 0; j < i; j++) {
      if (periods[i]!.start <= periods[j]!.end && periods[j]!.start <= periods[i]!.end) {
        totalOverlaps++;
        if (divergences.length < 100)
          divergences.push(
            `Intervalos ${j + 1} e ${i + 1} se sobrepõem; não foram somados em duplicidade. Confira se são vínculos distintos ou datas divergentes.`,
          );
      }
    }
  }
  if (totalOverlaps > 100)
    gaps.push(`Há ${totalOverlaps} pares sobrepostos; exibidos somente os primeiros 100 avisos.`);
  return {
    version: "administrative-dossier-v1" as const,
    referenceDate: reference,
    releaseStatus: "administrative_only" as const,
    notice:
      "Organização administrativa. Conferido pela pessoa não significa comprovado juridicamente. Nenhuma elegibilidade, renda, prazo ou conclusão jurídica foi emitida.",
    periods,
    documents: reviewed,
    arithmetic: {
      unionDays,
      reviewedDays,
      declaredOnlyDays: unionDays - reviewedDays,
      overlapsRemovedDays: raw - unionDays,
      inclusiveEndpoints: true,
      unit: "dias corridos dos intervalos selecionados",
    },
    contributionTime: { status: "blocked", value: null },
    carencia: { status: "blocked", value: null },
    divergences,
    gaps,
    legalReferences: latestLegalRecords().map((record) => ({
      id: record.id,
      title: record.title,
      url: record.url,
      version: record.version,
      revision: record.revision,
      status: "pending_legal_review" as const,
    })),
    nextSteps: [
      "Conferir campos e períodos com CNIS, CTPS e demais documentos disponíveis.",
      "Verificar pendências administrativas nos canais oficiais do INSS com apoio profissional.",
      "Avaliar eventual medida administrativa ou judicial com profissional habilitado, após conferência dos fatos, fontes e prazos; nenhuma medida foi escolhida automaticamente.",
    ],
    pdfAvailable: false as const,
    canConclude: false as const,
  };
}
export type DocumentDossier = ReturnType<typeof buildDocumentDossier>;

async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 131072) {
      await reader.cancel();
      throw new Error("large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
}

export async function handleDocumentModule(request: Request, auth: Auth) {
  let raw: unknown;
  try {
    raw = await readBody(request);
  } catch (error) {
    return documentJson(
      { error: "Envie dados válidos dentro do limite." },
      error instanceof Error && error.message === "large" ? 413 : 400,
    );
  }
  const parsed = documentModuleRequestSchema.safeParse(raw);
  if (!parsed.success) return documentJson({ error: "Confira os campos informados." }, 400);
  const input = parsed.data;
  if (input.operation === "review") {
    const found = await auth.client
      .from("previdenciary_documents")
      .select("*")
      .eq("id", input.documentId)
      .eq("user_id", auth.userId)
      .single();
    const doc = found.data;
    if (found.error || !doc || doc.user_id !== auth.userId || !active(doc, Date.now()))
      return documentJson({ error: "Documento indisponível." }, 404);
    if (doc.sha256 !== input.sha256 || doc.extraction_version !== input.extractionVersion)
      return documentJson({ error: "A extração mudou. Atualize a lista." }, 409);
    try {
      const extraction = safeExtraction(doc.extraction);
      if (
        extraction.documentType === "medico" ||
        extraction.fields.length !== input.decisions.length ||
        extraction.fields.length !== extractionSchema.parse(doc.extraction).fields.length ||
        extraction.limitations.length !== extractionSchema.parse(doc.extraction).limitations.length
      )
        throw new Error("invalid");
    } catch {
      return documentJson(
        { error: "Extração indisponível para conferência. Nenhuma prova foi confirmada." },
        400,
      );
    }
    const saved = await auth.client.rpc("review_document_fields", {
      p_document: doc.id,
      p_sha256: input.sha256,
      p_extraction_version: input.extractionVersion,
      p_expected_revision: input.expectedRevision,
      p_extraction: doc.extraction!,
      p_decisions: input.decisions,
    });
    if (saved.error) {
      const code = saved.error.code;
      const status =
        code === "40001"
          ? 409
          : code === "P0002"
            ? 404
            : code === "42501"
              ? 403
              : code === "22023"
                ? 400
                : code === "PGRST202"
                  ? 503
                  : 500;
      return documentJson(
        {
          error:
            status === 409
              ? "Outra conferência alterou o documento. Atualize a lista antes de salvar."
              : "Não foi possível salvar a conferência. Suas escolhas permanecem na tela.",
        },
        status,
      );
    }
    return documentJson({ ok: true });
  }
  const thread = await auth.client
    .from("investigations")
    .select("user_id")
    .eq("id", input.threadId)
    .eq("user_id", auth.userId)
    .single();
  if (thread.error || thread.data?.user_id !== auth.userId)
    return documentJson({ error: "Investigação indisponível." }, 404);
  const found = await auth.client
    .from("previdenciary_documents")
    .select("*")
    .eq("investigation_id", input.threadId)
    .eq("user_id", auth.userId)
    .eq("deletion_state", "active")
    .limit(101);
  if (found.error || !found.data || found.data.length > 100)
    return documentJson(
      { error: "Não foi possível carregar os documentos dentro do limite de 100 por relatório." },
      503,
    );
  const docs = found.data.filter(
    (doc) =>
      doc.user_id === auth.userId &&
      doc.investigation_id === input.threadId &&
      active(doc, Date.now()),
  );
  try {
    return documentJson({ ok: true, dossier: buildDocumentDossier(input, docs) });
  } catch {
    return documentJson(
      {
        error:
          "Confira datas, campos e revisões dos documentos. Nenhum intervalo inválido foi calculado.",
      },
      400,
    );
  }
}
