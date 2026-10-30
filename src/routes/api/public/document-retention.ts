import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { DOCUMENT_BUCKET } from "@/lib/document-policy";

export const Route = createFileRoute("/api/public/document-retention")({ server: { handlers: {
  POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const due = await supabaseAdmin.from("previdenciary_documents").select("id,storage_path").lte("delete_after", new Date().toISOString()).limit(50);
    if (due.error) return Response.json({ error: "retention_unavailable" }, { status: 503 });
    let deleted = 0;
    for (const doc of due.data) {
      const claim = await supabaseAdmin.from("previdenciary_documents").update({ deletion_state: "deleting" }).eq("id", doc.id).lte("delete_after", new Date().toISOString()).select("id");
      if (claim.error || !claim.data?.length) continue;
      const removed = await supabaseAdmin.storage.from(DOCUMENT_BUCKET).remove([doc.storage_path]);
      if (removed.error) continue;
      const metadata = await supabaseAdmin.from("previdenciary_documents").delete().eq("id", doc.id).eq("deletion_state", "deleting");
      if (!metadata.error) deleted++;
    }
    return Response.json({ deleted }, { headers: { "Cache-Control": "no-store" } });
  },
} } });