import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { safeExtraction } from "@/lib/document-policy";
import { reviewDecisionsSchema, type ReviewDecision } from "@/lib/document-dossier-schema";
import type { Tables } from "@/integrations/supabase/types";
import { cloudAdapter } from "@/lib/api/cloud-adapter";

export function DocumentFieldReview({
  document,
  onSaved,
}: {
  document: Tables<"previdenciary_documents">;
  onSaved: () => Promise<unknown>;
}) {
  const parsed = safeExtraction(document.extraction);
  const prior = reviewDecisionsSchema.safeParse(document.administrative_review);
  const [decisions, setDecisions] = useState<ReviewDecision[]>(() =>
    prior.success && prior.data.length === parsed.fields.length
      ? prior.data
      : parsed.fields.map(() => "pending"),
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const running = useRef(false);
  if (parsed.documentType === "medico" || !parsed.fields.length)
    return <p className="mt-2 text-sm">Nenhum campo administrativo disponível para conferência.</p>;
  return (
    <section className="mt-3 rounded border p-3" aria-label="Conferência dos campos extraídos">
      <h4 className="font-bold">Confira no arquivo original</h4>
      <p className="text-sm">
        Confirme somente campos que você comparou com o documento. Esta confirmação não valida
        autenticidade nem transforma informação em prova jurídica. Para corrigir uma sugestão
        errada, rejeite-a; o texto extraído permanece preservado.
      </p>
      {parsed.fields.map((field, index) => (
        <label key={index} className="mt-3 block">
          <span className="block">
            {field.field}: {field.value} · página {field.page}
          </span>
          <span className="block text-sm">Trecho sugerido: “{field.quote}”</span>
          <select
            className="mt-1 rounded border p-2"
            aria-label={`Conferência do campo ${index + 1}`}
            value={decisions[index]}
            disabled={busy}
            onChange={(event) => {
              const decision = event.target.value as ReviewDecision;
              setDecisions((old) => old.map((value, i) => (i === index ? decision : value)));
            }}
          >
            <option value="pending">Ainda não conferi</option>
            <option value="confirmed">Comparei e corresponde ao documento</option>
            <option value="rejected">Não corresponde / rejeitar sugestão</option>
          </select>
        </label>
      ))}
      <Button
        className="mt-3"
        disabled={busy}
        onClick={async () => {
          if (running.current) return;
          running.current = true;
          setBusy(true);
          setNotice("");
          try {
            await cloudAdapter.documentModule({
              operation: "review",
              documentId: document.id,
              sha256: document.sha256,
              extractionVersion: document.extraction_version!,
              expectedRevision: document.review_revision,
              decisions,
            });
            await onSaved();
            setNotice("Conferência salva. Os dados continuam sem validação jurídica.");
          } catch (error) {
            setNotice(
              error instanceof Error
                ? error.message
                : "Não foi possível salvar. Suas escolhas permanecem na tela.",
            );
          } finally {
            running.current = false;
            setBusy(false);
          }
        }}
      >
        {busy ? "Salvando conferência…" : "Salvar conferência dos campos"}
      </Button>
      {notice && (
        <p role="status" className="mt-2">
          {notice}
        </p>
      )}
    </section>
  );
}
