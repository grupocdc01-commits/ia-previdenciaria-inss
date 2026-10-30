import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/shell";
import { useCase } from "@/lib/case-store";
import { adapter } from "@/lib/api/adapter";
import { API_ERROR_MESSAGE, ApiError, type Analysis } from "@/lib/api/types";

export const Route = createFileRoute("/resultado")({
  head: () => ({
    meta: [
      { title: "Relatório de orientação previdenciária" },
      { name: "description", content: "Resumo do caso, próximos passos e preparo para conversar com um advogado." },
      { property: "og:title", content: "Relatório de orientação previdenciária" },
      { property: "og:description", content: "Resumo do caso, próximos passos e preparo para conversar com um advogado." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Resultado,
});

function Sec({ t, children }: { t: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-2xl font-semibold">{t}</h2>
      {children}
    </section>
  );
}
const List = ({ items, empty = "Nada informado." }: { items: string[]; empty?: string }) =>
  items.length ? <ul className="list-disc pl-5">{items.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="text-muted-foreground">{empty}</p>;

function Resultado() {
  const { caseId } = useCase();
  const [r, setR] = useState<Analysis | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    adapter.getAnalysis(caseId).then(setR).catch((e) => setErr(API_ERROR_MESSAGE[e instanceof ApiError ? e.kind : "unknown"]));
  }, [caseId]);

  if (err) return <Page title="Relatório indisponível"><p role="alert">{err}</p></Page>;
  if (!r) return <Page title="Carregando relatório…"><p>Aguarde.</p></Page>;

  return (
    <Page title="Relatório de orientação previdenciária" step="Exemplo simulado — não é resultado real">
      {r.urgencias.length > 0 && (
        <div role="alert" className="mb-6 rounded-xl border-2 border-destructive bg-card p-5">
          <h2 className="text-xl font-semibold text-destructive">⚠ Atenção a prazos</h2>
          <List items={r.urgencias} />
        </div>
      )}
      <p className="text-lg">{r.resumo}</p>

      <Sec t="Linha do tempo">
        <ol className="grid gap-2">
          {r.linhaDoTempo.map((e) => (
            <li key={e.fato} className="rounded-lg bg-card border border-border p-3">
              <strong>{e.data}</strong> — {e.fato}{" "}
              <span className="ml-1 rounded bg-muted px-2 text-sm">{e.origem === "documentado" ? "📄 Documentado" : "💬 Declarado"}</span>
            </li>
          ))}
        </ol>
      </Sec>
      <Sec t="Documentos analisados"><List items={r.documentosAnalisados} /></Sec>
      <div className="grid gap-4 sm:grid-cols-2">
        <Sec t="Fatos declarados"><List items={r.fatosDeclarados} /></Sec>
        <Sec t="Fatos comprovados"><List items={r.fatosComprovados} empty="Nenhum fato comprovado por documento." /></Sec>
      </div>
      <Sec t="Motivo informado pelo INSS">
        <p>{r.motivoInss ?? "Não documentado. Faltam documentos para saber o motivo."}</p>
      </Sec>
      <Sec t="Explicação em linguagem simples"><p>{r.explicacao}</p></Sec>
      <Sec t="Pontos a esclarecer"><List items={r.inconsistencias} /></Sec>
      {(r.fundamentosFavoraveis.length > 0 || r.fundamentosContrarios.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Sec t="A favor"><List items={r.fundamentosFavoraveis} /></Sec>
          <Sec t="Contra"><List items={r.fundamentosContrarios} /></Sec>
        </div>
      )}
      <Sec t="Limitações da análise"><List items={r.limitacoes} /></Sec>
      <Sec t="Próximos passos"><List items={r.proximosPassos} /></Sec>
      <Sec t="Fontes e data">
        <List items={r.fontes} />
        <p className="mt-2 text-sm text-muted-foreground">Data da análise: {r.dataAnalise}</p>
      </Sec>

      <section className="mt-10 rounded-2xl bg-secondary p-6">
        <h2 className="text-2xl font-semibold">Como se preparar para conversar com um advogado</h2>
        <h3 className="mt-4 text-lg font-semibold">Documentos já disponíveis</h3>
        <List items={r.preparoAdvogado.disponiveis} />
        <h3 className="mt-4 text-lg font-semibold">Documentos faltantes</h3>
        <ul className="grid gap-2">
          {r.preparoAdvogado.faltantes.map((f) => (
            <li key={f.nome} className="rounded-lg bg-card p-3">
              <strong>{f.nome}</strong>
              <br />Por que: {f.porque}
              <br />Onde obter: {f.onde}
            </li>
          ))}
        </ul>
        <h3 className="mt-4 text-lg font-semibold">Perguntas para levar à consulta</h3>
        <List items={r.preparoAdvogado.perguntas} />
      </section>

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="text-xl font-semibold">PDF do relatório</h2>
        {r.pdf.disponivel ? (
          <>
            <p>Expira em: {r.pdf.expiraEm}</p>
            <Button disabled className="mt-3 h-12">Baixar PDF (indisponível no modo demonstrativo)</Button>
          </>
        ) : (
          <p className="text-muted-foreground">PDF ainda indisponível para este caso.</p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">O PDF é gerado pela plataforma e tem prazo de expiração.</p>
      </section>
      <Button asChild variant="outline" className="mt-8 h-14 text-lg"><Link to="/exemplos">Ver outros exemplos</Link></Button>
    </Page>
  );
}
