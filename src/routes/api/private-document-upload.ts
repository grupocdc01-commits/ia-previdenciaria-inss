import { createFileRoute } from "@tanstack/react-router";
import { DOCUMENT_BUCKET, documentExpiry, validateDocumentBytes } from "@/lib/document-policy";
import { z } from "zod";

export const Route = createFileRoute("/api/private-document-upload")({ server: { handlers: {
  POST: async ({ request }) => {
    const { authenticateRequest } = await import("@/lib/api/request-auth.server");
    const auth = await authenticateRequest(request);
    if (!auth) return Response.json({ error: "Entre na sua conta." }, { status: 401 });
    if (Number(request.headers.get("content-length")) > 11 * 1024 * 1024) return Response.json({ error: "Envie até 10 MB." }, { status: 413 });
    try {
      const form = await request.formData();
      const threadId = z.string().uuid().parse(form.get("threadId"));
      const file = form.get("file");
      if (!(file instanceof File)) return Response.json({ error: "Arquivo ausente." }, { status: 400 });
      if (file.size > 10 * 1024 * 1024) return Response.json({ error: "Envie até 10 MB." }, { status: 413 });
      const thread = await auth.client.from("investigations").select("id").eq("id", threadId).eq("user_id", auth.userId).single();
      if (thread.error) return Response.json({ error: "Atendimento não encontrado." }, { status: 404 });
      const bytes = new Uint8Array(await file.arrayBuffer());
      validateDocumentBytes(bytes, file.type);
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
      const existing = await auth.client.from("previdenciary_documents").select("id").eq("investigation_id", threadId).eq("sha256", hash).maybeSingle();
      if (existing.error) throw new Error("Não foi possível verificar o registro.");
      if (existing.data) return Response.json({ id: existing.data.id, duplicate: true }, { headers: { "Cache-Control": "no-store" } });
      const prefs = await auth.client.from("private_processing_preferences").select("retention_days").eq("user_id", auth.userId).maybeSingle();
      if (prefs.error) throw new Error("Não foi possível conferir a retenção.");
      const id = crypto.randomUUID();
      const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
      const path = `${auth.userId}/${threadId}/${id}.${extension}`;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Authorization and content validation precede the privileged write; no browser INSERT policy.
      const uploaded = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
      if (uploaded.error) throw new Error("Não foi possível enviar o arquivo.");
      const created = new Date().toISOString();
      const saved = await supabaseAdmin.from("previdenciary_documents").insert({ id, user_id: auth.userId, investigation_id: threadId,
        storage_path: path, original_name: file.name.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 180), mime_type: file.type, byte_size: bytes.length, sha256: hash,
        delete_after: documentExpiry(created, prefs.data?.retention_days ?? null), created_at: created });
      if (saved.error) {
        await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([path]);
        throw new Error("Registro não salvo; o envio foi desfeito. Nenhum arquivo antigo foi alterado.");
      }
      return Response.json({ id, duplicate: false }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Envio indisponível." }, { status: 400 });
    }
  },
} } });