import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Paperclip, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cloudAdapter } from "@/lib/api/cloud-adapter";
import { useServerFn } from "@tanstack/react-start";
import { PrivateDocuments } from "./private-documents";

export function InvestigationDocuments({ threadId }: { threadId: string }) {
  const input = useRef<HTMLInputElement | null>(null);
  const client = useQueryClient();
  const skip = useServerFn(cloudAdapter.skipDocuments);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: ["private-documents", threadId],
    queryFn: () => cloudAdapter.documents(threadId),
  });
  const action = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setNotice("");
    try {
      await fn();
      await client.invalidateQueries({ queryKey: ["private-documents", threadId] });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="border-t border-border mt-8 pt-6">
      <h2 className="text-xl font-bold">Documentos opcionais</h2>
      <p className="mt-2 text-muted-foreground">
        Carta de indeferimento, CNIS, carteira de trabalho, PPP, documentos médicos pertinentes e
        outros comprovantes. Fotos e PDFs.
      </p>
      <p className="mt-2 text-sm">
        Sem documentos, a investigação pode ser menos precisa. Os arquivos são privados, mas ainda
        não foram lidos nem confirmados pela assistente.
      </p>
      <PrivateDocuments threadId={threadId} />
      <h3 className="mt-6 font-bold">Anexos anteriores</h3>
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        aria-label="Enviar documento"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void action(() => cloudAdapter.upload(threadId, file));
          e.target.value = "";
        }}
      />
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          variant="outline"
          className="h-12"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Paperclip />
          Enviar foto ou PDF
        </Button>
        <Button
          variant="ghost"
          className="h-12 whitespace-normal text-left"
          disabled={busy}
          onClick={() =>
            action(async () => {
              await skip({ data: { id: threadId } });
              setNotice(
                "Você pode continuar sem documentos. A precisão da investigação pode ficar limitada.",
              );
            })
          }
        >
          CONTINUAR SEM DOCUMENTOS
        </Button>
      </div>
      {query.error && (
        <p role="alert" className="mt-3 text-destructive">
          Não foi possível carregar os documentos.
        </p>
      )}
      {query.data && (
        <ul className="mt-4 divide-y divide-border">
          {query.data.map((file) => (
            <li key={file.path} className="flex items-center gap-2 py-3">
              <span className="min-w-0 flex-1 break-all">{file.name.slice(37)}</span>
              <Button
                variant="ghost"
                size="icon"
                title="Abrir documento privado"
                aria-label="Abrir documento privado"
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    const url = await cloudAdapter.openDocument(file.path);
                    window.open(url, "_blank", "noopener,noreferrer");
                  })
                }
              >
                <Eye />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Excluir documento"
                aria-label="Excluir documento"
                disabled={busy}
                onClick={() => action(() => cloudAdapter.deleteDocument(file.path))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {notice && (
        <p role="status" className="mt-3">
          {notice}
        </p>
      )}
    </section>
  );
}
