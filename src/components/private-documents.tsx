import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Eye, Trash2, FileSearch, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cloudAdapter } from "@/lib/api/cloud-adapter";
import { safeExtraction } from "@/lib/document-policy";

export function PrivateDocuments({ threadId }: { threadId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [consent, setConsent] = useState(false);
  const query = useQuery({
    queryKey: ["previdenciary-documents", threadId],
    queryFn: () => cloudAdapter.privateDocuments({ data: { id: threadId } }),
  });
  const action = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setNotice("");
    try {
      await fn();
      await client.invalidateQueries({ queryKey: ["previdenciary-documents", threadId] });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mt-6 border-t border-border pt-5">
      <h3 className="text-lg font-bold">Novos documentos privados</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        PDF, JPG ou PNG, até 10 MB. Anexos antigos continuam disponíveis abaixo. Nenhum documento é
        obrigatório.
      </p>
      <input
        ref={input}
        type="file"
        className="sr-only"
        aria-label="Enviar novo documento privado"
        accept="application/pdf,image/png,image/jpeg"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file)
            void action(async () => {
              const result = await cloudAdapter.uploadPrivate(threadId, file);
              setNotice(
                result.duplicate
                  ? "Este arquivo já está salvo neste atendimento."
                  : "Documento salvo com acesso privado.",
              );
            });
          e.target.value = "";
        }}
      />
      <Button
        variant="outline"
        className="mt-3"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        <Paperclip />
        Enviar documento privado
      </Button>
      <label className="mt-4 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        Autorizo enviar este documento administrativo ao Gemini para leitura; confirmei que não
        contém dados médicos. A leitura precisa de revisão e não é análise jurídica.
      </label>
      {query.error && <p role="alert">Não foi possível carregar os novos documentos.</p>}
      <ul className="mt-3 divide-y divide-border">
        {query.data?.map((doc) => {
          const parsed = doc.extraction ? safeExtraction(doc.extraction) : null;
          return (
            <li key={doc.id} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 break-all">{doc.original_name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Abrir documento temporariamente"
                  aria-label="Abrir novo documento privado"
                  disabled={busy}
                  onClick={() =>
                    action(async () => {
                      const url = await cloudAdapter.openPrivate({ data: { id: doc.id } });
                      window.open(url, "_blank", "noopener,noreferrer");
                    })
                  }
                >
                  <Eye />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title="Excluir novo documento"
                  aria-label="Excluir novo documento"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Excluir este documento e sua leitura? Esta ação não pode ser desfeita.",
                      )
                    )
                      void action(() => cloudAdapter.deletePrivate({ data: { id: doc.id } }));
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {doc.status === "needs_review"
                  ? "Leitura não verificada · revisão necessária"
                  : doc.status === "processing"
                    ? "Leitura em andamento"
                    : "Ainda não lido"}{" "}
                · {Math.ceil(doc.byte_size / 1024)} KB
              </p>
              {doc.delete_after && (
                <p className="text-sm">
                  Exclusão prevista: {new Date(doc.delete_after).toLocaleDateString("pt-BR")}
                </p>
              )}
              {!parsed && (
                <Button
                  variant="outline"
                  className="mt-2"
                  disabled={busy || !consent || doc.status === "processing"}
                  onClick={() =>
                    action(() =>
                      cloudAdapter.extractPrivate({
                        data: { id: doc.id, consent: true, nonMedical: true },
                      }),
                    )
                  }
                >
                  <FileSearch />
                  Ler dados administrativos
                </Button>
              )}
              {parsed && (
                <details className="mt-2">
                  <summary>Campos sugeridos e origem — não verificados</summary>
                  <p className="text-sm mt-2">
                    Versão {doc.extraction_version} · {doc.model}. Páginas e trechos indicados pela
                    IA, ainda não conferidos.
                  </p>
                  <dl className="space-y-2 mt-2">
                    {parsed.fields.map((field, i) => (
                      <div key={i}>
                        <dt className="font-bold">
                          {field.field}: {field.value}
                        </dt>
                        <dd className="text-sm">
                          Página {field.page} · “{field.quote}”
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {parsed.limitations.map((text, i) => (
                    <p key={i} className="text-sm mt-2">
                      {text}
                    </p>
                  ))}
                </details>
              )}
            </li>
          );
        })}
      </ul>
      {notice && (
        <p role="status" className="mt-3">
          {notice}
        </p>
      )}
    </section>
  );
}
