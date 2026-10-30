import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseFacts,
  textPartsSchema,
  INSUFFICIENT,
  scopeNotice,
  interviewQuestions,
  STORY_OPENING,
} from "@/lib/investigation";

export const listInvestigations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("investigations")
      .select("id,title,benefit,updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error("Não foi possível carregar suas investigações.");
    return data;
  });
export const createInvestigation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("investigations")
      .insert({ user_id: context.userId, facts: { storyStatus: "collecting", story: [] } })
      .select("id")
      .single();
    if (error) throw new Error("Não foi possível iniciar a investigação.");
    const saved = await context.supabase.from("investigation_messages").insert({
      investigation_id: data.id,
      client_id: `opening-${data.id}`,
      role: "assistant",
      parts: [{ type: "text", text: STORY_OPENING }],
    });
    if (saved.error) throw new Error("Não foi possível salvar a primeira pergunta.");
    return data;
  });
export const getInvestigation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data: input, context }) => {
    const { data, error } = await context.supabase
      .from("investigations")
      .select("*")
      .eq("id", input.id)
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error("Investigação não encontrada ou sem acesso.");
    const history = await context.supabase
      .from("investigation_messages")
      .select("client_id,role,parts")
      .eq("investigation_id", input.id)
      .order("created_at")
      .limit(1000);
    if (history.error) throw new Error("Não foi possível recuperar as mensagens.");
    const facts = parseFacts(data.facts);
    return {
      ...data,
      facts,
      messages: history.data.map((row) => ({
        id: row.client_id,
        role: row.role === "user" ? ("user" as const) : ("assistant" as const),
        parts: textPartsSchema.parse(row.parts),
      })),
    };
  });
export const skipDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const found = await context.supabase
      .from("investigations")
      .select("facts")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (found.error) throw new Error("Investigação não encontrada.");
    const facts = { ...parseFacts(found.data.facts), documentsSkipped: true };
    const saved = await context.supabase
      .from("investigations")
      .update({ facts })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (saved.error) throw new Error("Não foi possível salvar sua escolha.");
    return { ok: true };
  });
export const getInvestigationPanel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const result = await context.supabase
      .from("investigations")
      .select("benefit,facts")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (result.error) throw new Error("Investigação não encontrada.");
    const facts = parseFacts(result.data.facts);
    return {
      status: "indeterminate" as const,
      summary: INSUFFICIENT,
      benefit: result.data.benefit,
      reason: facts.answers["reason"] ?? null,
      scope: scopeNotice(result.data.benefit),
      declarations: interviewQuestions(result.data.benefit).flatMap((q) =>
        facts.answers[q.key] ? [{ question: q.label, answer: facts.answers[q.key] }] : [],
      ),
      confirmed: [] as string[],
      inconsistencies: [] as string[],
      verifiedSources: [] as string[],
      deadlines:
        "Prazos precisam ser confirmados com a decisão, a data de ciência e a regra aplicável. Nenhum prazo foi calculado.",
      nextSteps: [
        "Reunir a decisão do INSS e conferir o motivo literal da negativa.",
        "Conferir documentos e datas com um profissional habilitado.",
        "Aguardar validação do módulo jurídico antes de uma conclusão especializada.",
      ],
      pdfAvailable: false,
    };
  });
