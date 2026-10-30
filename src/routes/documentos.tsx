import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/shell";
import { useCase } from "@/lib/case-store";
import { documentList, type DocStatus } from "@/lib/case-model";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos — Orientação Previdenciária" },
      { name: "description", content: "Lista personalizada de documentos que podem ajudar no seu caso." },
      { property: "og:title", content: "Documentos — Orientação Previdenciária" },
      { property: "og:description", content: "Lista personalizada de documentos que podem ajudar no seu caso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Documentos,
});

const OPTS: [DocStatus, string, string][] = [
  ["disponivel", "✓ Disponível", "border-success bg-success text-success-foreground"],
  ["falta", "✗ Falta obter", "border-warning bg-warning text-warning-foreground"],
  ["nao_sei", "? Não sei como conseguir", "border-input bg-muted"],
];

function Documentos() {
  const { answers: a, setAnswers } = useCase();
  const docs = documentList(a);
  return (
    <Page title="Documentos que podem ajudar" step="Documentos">
      <ul className="grid gap-4">
        {docs.map((d) => (
          <li key={d.id} className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-xl font-semibold">{d.nome}</h2>
            <p className="mt-1"><strong>Por que ajuda:</strong> {d.porque}</p>
            <p className="text-muted-foreground"><strong>Onde obter:</strong> {d.onde}</p>
            <fieldset className="mt-4 flex flex-wrap gap-2">
              <legend className="sr-only">Situação de {d.nome}</legend>
              {OPTS.map(([v, label, on]) => {
                const sel = a.docStatus[d.id] === v;
                return (
                  <label key={v} className={cn("cursor-pointer rounded-lg border-2 px-3 py-2 font-bold", sel ? on : "border-border")}>
                    <input type="radio" className="sr-only" name={d.id} checked={sel} onChange={() => setAnswers((x) => ({ ...x, docStatus: { ...x.docStatus, [d.id]: v } }))} />
                    {label}
                  </label>
                );
              })}
            </fieldset>
          </li>
        ))}
      </ul>
      <section className="mt-8 rounded-xl border-2 border-dashed border-input p-5">
        <h2 className="text-xl font-semibold">Envio de arquivos</h2>
        <p className="mt-2">
          Os documentos servem para organizar seu caso e preparar o relatório. Arquivos são temporários, mas resumos,
          trechos e informações técnicas podem continuar guardados.
        </p>
        <p className="mt-2 font-bold">No modo demonstrativo, o envio de documentos pessoais está desativado.</p>
        <p className="text-sm text-muted-foreground">Quando ativado, arquivos ficarão em quarentena e não serão lidos automaticamente.</p>
        <Button disabled variant="outline" className="mt-3 h-12">Enviar arquivo (desativado)</Button>
      </section>
      <div className="mt-8 flex justify-between gap-3">
        <Button asChild variant="outline" className="h-14 px-6 text-lg"><Link to="/perguntas">← Voltar</Link></Button>
        <Button asChild className="h-14 px-8 text-lg"><Link to="/conferencia">Conferir dados</Link></Button>
      </div>
    </Page>
  );
}
