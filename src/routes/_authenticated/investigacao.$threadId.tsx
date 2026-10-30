import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { cloudAdapter } from "@/lib/api/cloud-adapter";
import { InvestigationShell } from "@/components/investigation-shell";
import { InvestigationChat } from "@/components/investigation-chat";
const threadQuery = (id: string) =>
  queryOptions({
    queryKey: ["private-investigation", id],
    queryFn: () => cloudAdapter.get({ data: { id } }),
  });
export const Route = createFileRoute("/_authenticated/investigacao/$threadId")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(threadQuery(params.threadId)),
  head: () => ({
    meta: [
      { title: "Atendimento privado — Investigação INSS" },
      {
        name: "description",
        content: "Conversa privada para reunir informações sobre a negativa do INSS.",
      },
      { property: "og:title", content: "Atendimento privado — Investigação INSS" },
      { property: "og:description", content: "Triagem conversacional com documentos opcionais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Thread,
});
function Thread() {
  const { threadId } = Route.useParams();
  const pathname = useLocation({ select: (location) => location.pathname });
  const { data } = useSuspenseQuery(threadQuery(threadId));
  if (pathname.endsWith("/painel")) return <Outlet />;
  return (
    <InvestigationShell>
      <div className="max-w-3xl mx-auto">
        <Link to="/investigacoes" className="inline-block mb-6 text-primary underline">
          ← Minhas investigações
        </Link>
        <InvestigationChat key={threadId} thread={data} />
        <Outlet />
      </div>
    </InvestigationShell>
  );
}
