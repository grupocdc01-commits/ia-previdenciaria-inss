import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/shell";
import { useCase } from "@/lib/case-store";
import { documentList, LABELS, missingInfo, adaptedQuestions } from "@/lib/case-model";
import { ContextualSummary } from "@/components/contextual-summary";

export const Route = createFileRoute("/conferencia")({
  head: () => ({
    meta: [
      { title: "Conferência — Orientação Previdenciária" },
      { name: "description", content: "Revise as informações antes de solicitar a análise." },
      { property: "og:title", content: "Conferência — Orientação Previdenciária" },
      {
        property: "og:description",
        content: "Revise as informações antes de solicitar a análise.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Conferencia,
});

function Row({
  k,
  v,
  to,
}: {
  k: string;
  v?: string | undefined;
  to: "/questionario" | "/documentos";
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border py-3">
      <dt className="font-bold">{k}</dt>
      <dd className="flex gap-3">
        <span>{v || "Não informado"}</span>
        <Link to={to} className="text-primary underline underline-offset-4">
          Corrigir
        </Link>
      </dd>
    </div>
  );
}

function Conferencia() {
  const { answers: a } = useCase();
  const nav = useNavigate();
  const [ok, setOk] = useState(false);
  const docs = documentList(a);
  const falta = missingInfo(a);
  return (
    <Page title="Confira suas informações" step="Conferência">
      <dl>
        <Row k="Benefício" v={a.beneficio && LABELS.beneficio[a.beneficio]} to="/questionario" />
        <Row k="Situação" v={a.situacao && LABELS.situacao[a.situacao]} to="/questionario" />
        <Row k="Para quem" v={a.paraQuem && LABELS.paraQuem[a.paraQuem]} to="/questionario" />
        <Row
          k="Idade / estado"
          v={[a.idade, a.uf].filter(Boolean).join(" · ")}
          to="/questionario"
        />
        {a.situacao === "negado" && (
          <Row k="Data da negativa" v={a.dataNegativa} to="/questionario" />
        )}
        <Row
          k="Documentos fornecidos"
          v={docs
            .filter((d) => a.docStatus[d.id] === "disponivel")
            .map((d) => d.nome)
            .join(", ")}
          to="/documentos"
        />
      </dl>
      <ContextualSummary input={a} />
      {Object.keys(a.adaptadasStatus ?? {}).length > 0 && (
        <section className="mt-5">
          <h2 className="text-xl font-bold">Respostas complementares</h2>
          <ul>
            {adaptedQuestions(a)
              .filter((question) => a.adaptadasStatus?.[question.id])
              .map((question) => (
                <li key={question.id}>
                  <strong>{question.pergunta}</strong>:{" "}
                  {a.adaptadasStatus?.[question.id] === "confirmado"
                    ? a.adaptadas[question.id]
                    : a.adaptadasStatus?.[question.id] === "nao_sei"
                      ? "Não sei"
                      : "Pulado"}
                </li>
              ))}
          </ul>
        </section>
      )}
      {falta.length > 0 && (
        <section className="mt-6 rounded-xl bg-warning p-5 text-warning-foreground">
          <h2 className="text-xl font-semibold">⚠ Informações que ainda faltam</h2>
          <ul className="mt-2 list-disc pl-5">
            {falta.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="mt-2 text-sm">Você pode continuar. O relatório vai apontar o que falta.</p>
        </section>
      )}
      <label className="mt-8 flex cursor-pointer items-start gap-3 rounded-xl border-2 border-border bg-card p-4">
        <input
          type="checkbox"
          checked={ok}
          onChange={(e) => setOk(e.target.checked)}
          className="mt-1 size-5 accent-primary"
        />
        <span>
          Confirmo que revisei as informações, que são fictícias, e quero iniciar a análise de
          demonstração.
        </span>
      </label>
      <Button
        className="mt-6 h-14 w-full text-lg"
        disabled={!ok}
        onClick={() => nav({ to: "/acompanhamento" })}
      >
        Iniciar análise
      </Button>
    </Page>
  );
}
