import { useRef, useState } from "react";
import type { Tables } from "@/integrations/supabase/types";
import type { DossierRequest } from "@/lib/document-dossier-schema";
import type { DocumentDossier as Dossier } from "@/lib/api/document-dossier.server";
import { cloudAdapter } from "@/lib/api/cloud-adapter";
import { safeExtraction } from "@/lib/document-policy";
import { reviewDecisionsSchema } from "@/lib/document-dossier-schema";
import { Button } from "@/components/ui/button";

export function DocumentDossier({
  threadId,
  documents,
}: {
  threadId: string;
  documents: Tables<"previdenciary_documents">[];
}) {
  const [periods, setPeriods] = useState<DossierRequest["periods"]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [startField, setStartField] = useState("");
  const [endField, setEndField] = useState("");
  const [report, setReport] = useState<Dossier | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const selected = documents.find((doc) => doc.id === documentId);
  let parsed: ReturnType<typeof safeExtraction> | null = null;
  try {
    parsed = selected?.extraction ? safeExtraction(selected.extraction) : null;
  } catch {
    /* No fields offered from malformed legacy data. */
  }
  const review = reviewDecisionsSchema.safeParse(selected?.administrative_review);
  const reportCurrent =
    !report ||
    report.documents.every((item) =>
      documents.some(
        (doc) =>
          doc.id === item.documentId &&
          doc.review_revision === item.revision &&
          (!doc.delete_after || Date.parse(doc.delete_after) > Date.now()),
      ),
    );
  const add = (period: DossierRequest["periods"][number]) => {
    if (periods.length >= 500) {
      setNotice("Limite de 500 períodos por relatório.");
      return;
    }
    setPeriods((old) => [...old, period]);
    setReport(null);
    setNotice("");
  };
  return (
    <section
      className="mt-6 border-t pt-5"
      aria-label="Relatório administrativo de documentos e períodos"
    >
      <h3 className="text-lg font-bold">Organizar períodos e lacunas</h3>
      <p className="mt-2 text-sm">
        CNIS e CTPS são opcionais. Selecione cada par de datas do mesmo vínculo após conferi-lo;
        datas não são pareadas automaticamente. Intervalos declarados e seleção de períodos ficam
        apenas nesta tela, sem armazenamento no navegador. Ao sair ou recarregar, será necessário
        selecioná-los novamente.
      </p>
      <fieldset disabled={busy} className="mt-3 flex flex-wrap items-end gap-3">
        <legend className="font-bold">Período declarado</legend>
        <label>
          Início declarado
          <input
            aria-label="Início declarado"
            type="date"
            className="block rounded border p-2"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Fim declarado
          <input
            aria-label="Fim declarado"
            type="date"
            className="block rounded border p-2"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <Button
          variant="outline"
          disabled={!start || !end}
          onClick={() => {
            add({ origin: "declared", start, end });
            setStart("");
            setEnd("");
          }}
        >
          Adicionar período declarado
        </Button>
      </fieldset>
      <fieldset disabled={busy} className="mt-4 space-y-2">
        <legend className="font-bold">Período conferido no documento</legend>
        <label className="block">
          Documento
          <select
            aria-label="Documento do período"
            className="ml-2 rounded border p-2"
            value={documentId}
            onChange={(e) => {
              setDocumentId(e.target.value);
              setStartField("");
              setEndField("");
            }}
          >
            <option value="">Selecione</option>
            {documents
              .filter((doc) => doc.review_revision > 0)
              .map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.original_name}
                </option>
              ))}
          </select>
        </label>
        {(["inicio_vinculo", "fim_vinculo"] as const).map((kind) => (
          <label key={kind} className="block">
            {kind === "inicio_vinculo" ? "Campo de início" : "Campo de fim"}
            <select
              className="ml-2 rounded border p-2"
              aria-label={kind === "inicio_vinculo" ? "Campo de início" : "Campo de fim"}
              value={kind === "inicio_vinculo" ? startField : endField}
              onChange={(e) =>
                (kind === "inicio_vinculo" ? setStartField : setEndField)(e.target.value)
              }
            >
              <option value="">Selecione um campo confirmado</option>
              {parsed?.fields.map((field, index) =>
                field.field === kind && review.success && review.data[index] === "confirmed" ? (
                  <option key={index} value={index}>
                    {field.value} · página {field.page} · campo {index + 1}
                  </option>
                ) : null,
              )}
            </select>
          </label>
        ))}
        <Button
          variant="outline"
          disabled={!selected || startField === "" || endField === ""}
          onClick={() => {
            if (selected)
              add({
                origin: "document_review",
                documentId: selected.id,
                reviewRevision: selected.review_revision,
                startField: Number(startField),
                endField: Number(endField),
              });
          }}
        >
          Adicionar período conferido
        </Button>
      </fieldset>
      <ol className="mt-4 list-decimal pl-5">
        {periods.map((period, index) => (
          <li key={index} className="mt-2">
            {period.origin === "declared"
              ? `${period.start} a ${period.end} · declarado`
              : `Documento ${documents.find((doc) => doc.id === period.documentId)?.original_name ?? "indisponível"} · campos ${period.startField + 1}/${period.endField + 1} · revisão ${period.reviewRevision}`}
            <Button
              variant="ghost"
              disabled={busy}
              aria-label={`Remover período ${index + 1}`}
              onClick={() => {
                setPeriods((old) => old.filter((_, i) => i !== index));
                setReport(null);
              }}
            >
              Remover
            </Button>
          </li>
        ))}
      </ol>
      <Button
        className="mt-4"
        disabled={busy}
        onClick={async () => {
          if (running.current) return;
          running.current = true;
          setBusy(true);
          setNotice("");
          setReport(null);
          try {
            const result = await cloudAdapter.documentModule({
              operation: "dossier",
              threadId,
              periods,
            });
            if (!result.dossier) throw new Error("Relatório indisponível.");
            setReport(result.dossier);
          } catch (error) {
            setNotice(
              error instanceof Error ? error.message : "Não foi possível organizar os intervalos.",
            );
          } finally {
            setBusy(false);
            running.current = false;
          }
        }}
      >
        {busy ? "Organizando…" : "Gerar relatório administrativo"}
      </Button>
      {notice && (
        <p role="alert" className="mt-3">
          {notice}
        </p>
      )}
      {report && !reportCurrent && (
        <p role="status">
          A lista de documentos mudou. Gere novamente o relatório antes de utilizá-lo.
        </p>
      )}
      {report && reportCurrent && (
        <article className="mt-4 rounded border p-4" aria-label="Relatório administrativo">
          <h4 className="font-bold">Relatório administrativo · {report.referenceDate}</h4>
          <p className="mt-2">{report.notice}</p>
          <p className="mt-2">
            União dos intervalos: {report.arithmetic.unionDays} dias corridos, com as duas datas
            incluídas. Dias em intervalos conferidos pela pessoa: {report.arithmetic.reviewedDays}.
            Dias apenas declarados: {report.arithmetic.declaredOnlyDays}. Dias de sobreposição
            retirados da soma: {report.arithmetic.overlapsRemovedDays}.
          </p>
          <p className="font-bold mt-2">
            Tempo oficial de contribuição e carência: não calculados. PDF e conclusão jurídica
            indisponíveis.
          </p>
          <h5 className="font-bold mt-3">Divergências e lacunas</h5>
          <ul className="list-disc pl-5">
            {[...report.divergences, ...report.gaps].map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ul>
          <h5 className="font-bold mt-3">Próximos passos para conferência</h5>
          <ul className="list-disc pl-5">
            {report.nextSteps.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
          <details className="mt-3">
            <summary>Referências candidatas — pendentes de revisão jurídica</summary>
            <ul>
              {report.legalReferences.map((source) => (
                <li key={source.id}>
                  <a
                    className="underline"
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.title}
                  </a>{" "}
                  · versão {source.version}, revisão {source.revision}
                </li>
              ))}
            </ul>
          </details>
        </article>
      )}
    </section>
  );
}
