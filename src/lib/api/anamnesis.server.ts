import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { applyAnamnesisTurn } from "@/lib/anamnesis";
import { interviewRequestSchema } from "@/lib/anamnesis-schema";

export type AnamnesisAuth = { userId: string; client: SupabaseClient<Database> };
export const anamnesisJson = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const rpcResult = z.object({ duplicate: z.boolean(), updatedAt: z.string() }).strict();

async function boundedJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("empty");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    length += chunk.value.byteLength;
    if (length > 65536) {
      await reader.cancel();
      throw new Error("too_large");
    }
    chunks.push(chunk.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
}
export async function handleAnamnesisRequest(request: Request, auth: AnamnesisAuth) {
  let raw: unknown;
  try {
    raw = await boundedJson(request);
  } catch (error) {
    return anamnesisJson(
      {
        error:
          error instanceof Error && error.message === "too_large"
            ? "Envie uma resposta menor."
            : "Mensagem inválida.",
      },
      error instanceof Error && error.message === "too_large" ? 413 : 400,
    );
  }
  const parsed = interviewRequestSchema.safeParse(raw);
  if (!parsed.success) return anamnesisJson({ error: "Confira a resposta antes de enviar." }, 400);
  const input = parsed.data;
  const hashBytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify({ expectedUpdatedAt: input.expectedUpdatedAt, action: input.action }),
    ),
  );
  const hash = Array.from(new Uint8Array(hashBytes), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
  const thread = await auth.client
    .from("investigations")
    .select("id,user_id,benefit,facts,updated_at")
    .eq("id", input.threadId)
    .eq("user_id", auth.userId)
    .single();
  if (thread.error || !thread.data || thread.data.user_id !== auth.userId)
    return anamnesisJson({ error: "Investigação não encontrada." }, 404);
  const prior = await auth.client
    .from("anamnesis_turns")
    .select("request_hash")
    .eq("investigation_id", input.threadId)
    .eq("request_id", input.requestId)
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (prior.error)
    return anamnesisJson(
      { error: "A anamnese estruturada ainda não está disponível neste ambiente." },
      503,
    );
  if (prior.data)
    return prior.data.request_hash === hash
      ? anamnesisJson({ ok: true, duplicate: true })
      : anamnesisJson(
          { error: "Esta tentativa já foi usada com outra resposta. Atualize as perguntas." },
          409,
        );
  if (thread.data.updated_at !== input.expectedUpdatedAt)
    return anamnesisJson(
      {
        error: "Outra resposta atualizou a investigação. Atualize as perguntas antes de continuar.",
      },
      409,
    );
  let next: ReturnType<typeof applyAnamnesisTurn>;
  try {
    next = applyAnamnesisTurn(thread.data.benefit, thread.data.facts, input.action);
  } catch {
    return anamnesisJson(
      {
        error:
          "A resposta não corresponde à etapa atual. Confira os campos ou atualize as perguntas.",
      },
      400,
    );
  }
  const committed = await auth.client.rpc("commit_anamnesis_turn", {
    p_investigation: input.threadId,
    p_request: input.requestId,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_request_hash: hash,
    p_facts: next.facts,
    p_benefit: next.benefit,
    p_user_text: next.userText,
    p_assistant_text: next.assistantText,
  });
  if (committed.error) {
    const code = committed.error.code;
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
    return anamnesisJson(
      {
        error:
          status === 409
            ? "A investigação mudou. Atualize as perguntas; nenhuma resposta desta tentativa foi gravada."
            : status === 503
              ? "A anamnese estruturada ainda não foi habilitada neste ambiente."
              : "Não foi possível salvar esta etapa. Sua resposta permanece na tela para tentar novamente.",
      },
      status,
    );
  }
  const result = rpcResult.safeParse(committed.data);
  return result.success
    ? anamnesisJson({ ok: true, duplicate: result.data.duplicate })
    : anamnesisJson({ error: "Confira o histórico antes de repetir esta tentativa." }, 500);
}
