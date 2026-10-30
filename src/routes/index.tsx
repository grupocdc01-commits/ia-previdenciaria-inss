import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass, FileX, Landmark, FolderOpen, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Disclaimer } from "@/components/shell";
import { InvestigationShell } from "@/components/investigation-shell";
import { useCase } from "@/lib/case-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Você pode ter direitos que ainda não conhece — IA Previdenciária INSS" },
      {
        name: "description",
        content:
          "Orientação previdenciária em linguagem simples: descubra direitos, entenda uma negativa do INSS e organize seus documentos com privacidade.",
      },
      { property: "og:title", content: "Você pode ter direitos que ainda não conhece" },
      {
        property: "og:description",
        content: "Orientação guiada, uma pergunta por vez, com documentos privados e opcionais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Entry = {
  icon: typeof Compass;
  title: string;
  text: string;
  to: "/questionario" | "/investigacoes";
  status: string;
  ready: boolean;
};

const entries: Entry[] = [
  {
    icon: Compass,
    title: "Descobrir meus direitos",
    text: "Perguntas curtas para indicar caminhos possíveis.",
    to: "/questionario",
    status: "Triagem preliminar",
    ready: true,
  },
  {
    icon: FileX,
    title: "Meu pedido foi negado",
    text: "Conte o que aconteceu por texto ou áudio, no seu ritmo.",
    to: "/investigacoes",
    status: "Atendimento privado disponível",
    ready: true,
  },
  {
    icon: Landmark,
    title: "Minha aposentadoria",
    text: "Tempo de contribuição, carência e vínculos do CNIS.",
    to: "/investigacoes",
    status: "Cálculo jurídico em desenvolvimento",
    ready: false,
  },
  {
    icon: FolderOpen,
    title: "Meus documentos",
    text: "Guarde CNIS, CTPS e carta de indeferimento com acesso privado.",
    to: "/investigacoes",
    status: "Envio privado disponível",
    ready: true,
  },
];

function Index() {
  const { reset } = useCase();
  return (
    <InvestigationShell>
      <div className="mx-auto max-w-4xl">
        <section className="rounded-3xl bg-primary px-6 py-10 text-primary-foreground sm:px-10">
          <p className="text-sm font-bold uppercase tracking-wide opacity-80">
            IA Previdenciária INSS
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-5xl">
            Você pode ter direitos que ainda não conhece
          </h1>
          <p className="mt-4 max-w-2xl text-lg opacity-90">
            Explicamos em português simples, uma pergunta por vez. Você não precisa ter documentos
            em mãos para começar.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-7 h-auto min-h-14 whitespace-normal bg-teal px-6 py-4 text-lg text-teal-foreground hover:bg-teal/90"
          >
            <Link to="/investigacoes">
              Começar minha orientação <ArrowRight />
            </Link>
          </Button>
          <p className="mt-4 flex items-center gap-2 text-sm opacity-85">
            <ShieldCheck className="size-4 shrink-0" /> Seus dados ficam em uma conta privada.
          </p>
        </section>

        <h2 className="mt-10 text-2xl font-bold">Por onde você quer começar?</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {entries.map((e) => (
            <li key={e.title}>
              <Link
                to={e.to}
                onClick={e.to === "/questionario" ? reset : undefined}
                className="flex h-full gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <e.icon />
                </span>
                <span>
                  <span className="block text-xl font-bold">{e.title}</span>
                  <span className="block text-muted-foreground">{e.text}</span>
                  <span
                    className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-bold ${
                      e.ready ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"
                    }`}
                  >
                    {e.status}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <section className="mt-10 rounded-2xl bg-muted p-6">
          <h2 className="text-xl font-bold">Com transparência</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>A análise jurídica completa ainda está em desenvolvimento e passa por revisão humana.</li>
            <li>Não substituímos advogado, médico ou perito, e não temos vínculo com o INSS.</li>
            <li>Não garantimos a concessão do benefício.</li>
          </ul>
        </section>
        <Disclaimer className="mt-6" />
        <div className="mt-8">
          <Button asChild variant="outline" size="lg" className="h-14 px-6 text-lg">
            <Link to="/exemplos">Ver exemplos fictícios</Link>
          </Button>
        </div>
      </div>
    </InvestigationShell>
  );
}
