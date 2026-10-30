import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, ArrowRight } from "lucide-react";
import { cloudAdapter } from "@/lib/api/cloud-adapter";
import { Button } from "@/components/ui/button";
import { InvestigationShell } from "@/components/investigation-shell";
const investigationsQuery = queryOptions({
  queryKey: ["private-investigations"],
  queryFn: () => cloudAdapter.list(),
});
export const Route = createFileRoute("/_authenticated/investigacoes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(investigationsQuery),
  head: () => ({
    meta: [
      { title: "Minha Jornada — IA Previdenciária INSS" },
      { name: "description", content: "Retome suas conversas privadas sobre benefícios negados." },
      { property: "og:title", content: "Minhas investigações — INSS" },
      { property: "og:description", content: "Investigações separadas com histórico privado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Investigations,
});
function Investigations() {
  const { data } = useSuspenseQuery(investigationsQuery);
  const create = useServerFn(cloudAdapter.create);
  const nav = useNavigate();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <InvestigationShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold">Minha Jornada</h1>
        <p className="mt-2 text-muted-foreground">
          Cada atendimento guarda sua história, as perguntas respondidas e os documentos enviados, de forma privada.
        </p>
        <ol className="mt-5 grid gap-2 sm:grid-cols-4 text-sm" aria-label="Etapas da jornada">
          {["1. Contar a história", "2. Perguntas guiadas", "3. Documentos (opcional)", "4. Painel do caso"].map((s) => (
            <li key={s} className="rounded-lg bg-secondary px-3 py-2 font-bold text-secondary-foreground">{s}</li>
          ))}
        </ol>
        <Button
          className="mt-6 h-14 text-lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const thread = await create();
              await client.invalidateQueries({ queryKey: ["private-investigations"] });
              await nav({ to: "/investigacao/$threadId", params: { threadId: thread.id } });
            } catch (e) {
              setError(e instanceof Error ? e.message : "Não foi possível iniciar.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Plus />
          Começar novo atendimento
        </Button>
        {error && (
          <p role="alert" className="mt-4 text-destructive">
            {error}
          </p>
        )}
        {data.length === 0 ? (
          <p className="mt-8 text-muted-foreground">Você ainda não iniciou uma investigação.</p>
        ) : (
          <ul className="mt-8 divide-y divide-border">
            {data.map((thread) => (
              <li key={thread.id} className="py-5">
                <Link
                  to="/investigacao/$threadId"
                  params={{ threadId: thread.id }}
                  className="flex items-center justify-between gap-4 text-lg font-bold text-primary"
                >
                  <span>{thread.title}</span>
                  <ArrowRight className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </InvestigationShell>
  );
}
