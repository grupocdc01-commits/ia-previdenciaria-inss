import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { cloudAdapter } from "@/lib/api/cloud-adapter";
import { InvestigationShell } from "@/components/investigation-shell";
import { InvestigationDocuments } from "@/components/investigation-documents";
import { ContextualItems } from "@/components/contextual-summary";
import { Button } from "@/components/ui/button";
const panelQuery = (id: string) =>
  queryOptions({
    queryKey: ["private-panel", id],
    queryFn: () => cloudAdapter.panel({ data: { id } }),
  });
export const Route = createFileRoute("/_authenticated/investigacao/$threadId/painel")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(panelQuery(params.threadId)),
  head: () => ({
    meta: [
      { title: "Painel da investigação — INSS" },
      {
        name: "description",
        content: "Declarações, documentos e pontos ainda não confirmados da investigação.",
      },
      { property: "og:title", content: "Painel da investigação — INSS" },
      {
        property: "og:description",
        content: "Informações do caso separadas de conclusões jurídicas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Panel,
});
function Panel() {
  const { threadId } = Route.useParams();
  const { data } = useSuspenseQuery(panelQuery(threadId));
  type Evidence = "declarado" | "nao_verificado" | "sem_fonte";
  const badge: Record<Evidence, { label: string; cls: string }> = {
    declarado: { label: "Informado por você", cls: "bg-secondary text-secondary-foreground" },
    nao_verificado: { label: "Não verificado", cls: "bg-warning text-warning-foreground" },
    sem_fonte: { label: "Sem fonte validada", cls: "bg-muted text-muted-foreground" },
  };
  const sections: { title: string; text: string; kind: Evidence; uncertainty: string }[] = [
    {
      title: "1. Resumo do caso",
      text: data.benefit
        ? `Benefício informado: ${data.benefit}. ${data.scope}`
        : "Benefício ainda não informado.",
      kind: "declarado",
      uncertainty: "Baseado apenas no que você contou.",
    },
    {
      title: "2. Motivo informado pelo INSS",
      text: data.reason ?? "Ainda não informado.",
      kind: "nao_verificado",
      uncertainty: "A carta do INSS ainda não foi conferida.",
    },
    {
      title: "3. Informações confirmadas",
      text: "Nenhum fato foi validado como prova jurídica. A conferência de campos pelo titular é registrada separadamente nos documentos.",
      kind: "nao_verificado",
      uncertainty:
        "Conferir um campo não valida a autenticidade ou o valor probatório do documento.",
    },
    {
      title: "4. Possíveis inconsistências",
      text: "Divergências de datas e sobreposição de intervalos podem ser organizadas no relatório administrativo dos documentos. Requisitos jurídicos continuam sem conclusão.",
      kind: "sem_fonte",
      uncertainty: "Depende de revisão jurídica humana.",
    },
    {
      title: "5. Fundamentos jurídicos",
      text: "Nenhuma lei ou artigo é citado como conclusão neste atendimento.",
      kind: "sem_fonte",
      uncertainty: "Fontes oficiais estão cadastradas, mas aguardam revisão de um advogado.",
    },
  ];
  const Card = ({ s }: { s: (typeof sections)[number] }) => (
    <section className="mt-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{s.title}</h2>
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${badge[s.kind].cls}`}>
          {badge[s.kind].label}
        </span>
      </div>
      <p className="mt-3 text-lg">{s.text}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        <strong>Incerteza:</strong> {s.uncertainty}
      </p>
    </section>
  );
  return (
    <InvestigationShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display text-3xl font-bold">Painel da investigação</h1>
        <p
          role="status"
          className="mt-5 rounded-2xl bg-warning text-warning-foreground border-l-4 border-primary p-4 font-bold"
        >
          {data.summary}
        </p>
        <p className="mt-4 text-muted-foreground">
          Cada parte mostra de onde vem a informação. Nada aqui é uma decisão jurídica.
        </p>
        {sections.map((s) => (
          <Card key={s.title} s={s} />
        ))}
        {data.declarations.length > 0 && (
          <section className="mt-5 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold">Suas respostas</h2>
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${badge.declarado.cls}`}>
                {badge.declarado.label}
              </span>
            </div>
            <dl className="mt-3 space-y-4">
              {data.declarations.map((fact) => (
                <div key={fact.question}>
                  <dt className="font-bold">{fact.question}</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{fact.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        {data.anamnesis && (
          <>
            <ContextualItems items={data.anamnesis.contextual} />
            {data.anamnesis.notices.map((notice) => (
              <p role="status" key={notice}>
                {notice}
              </p>
            ))}
          </>
        )}
        <section className="mt-5 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl font-bold">6. Documentos que podem ajudar</h2>
          <InvestigationDocuments threadId={threadId} />
        </section>
        <section className="mt-5 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">7. Prazos que precisam ser confirmados</h2>
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold ${badge.nao_verificado.cls}`}
            >
              {badge.nao_verificado.label}
            </span>
          </div>
          <p className="mt-3">{data.deadlines}</p>
        </section>
        <section className="mt-5 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-xl font-bold">8. Próximos passos possíveis</h2>
          <ul className="mt-3 list-disc pl-5 space-y-2">
            {data.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </section>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="outline" className="h-12">
            <Link to="/investigacao/$threadId" params={{ threadId }}>
              Voltar à conversa
            </Link>
          </Button>
          <Button disabled className="h-12">
            Relatório PDF ainda indisponível
          </Button>
        </div>
      </div>
    </InvestigationShell>
  );
}
