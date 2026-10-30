import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Page } from "@/components/shell";
import { useCase } from "@/lib/case-store";
import { adapter, TERMINAL } from "@/lib/api/adapter";
import { API_ERROR_MESSAGE, ApiError, JOB_LABEL, type JobStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/acompanhamento")({
  head: () => ({
    meta: [
      { title: "Acompanhamento — Orientação Previdenciária" },
      { name: "description", content: "Acompanhe o processamento do seu caso." },
      { property: "og:title", content: "Acompanhamento — Orientação Previdenciária" },
      { property: "og:description", content: "Acompanhe o processamento do seu caso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Acompanhamento,
});

const FLOW: JobStatus[] = ["received", "queued", "processing", "completed"];

function Acompanhamento() {
  const { caseId } = useCase();
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    let t: ReturnType<typeof setTimeout>;
    (async () => {
      try {
        let job = await adapter.analyze(caseId);
        setStatus(job.status);
        const poll = async () => {
          if (stop) return;
          job = await adapter.getJob(job.id);
          setStatus(job.status);
          if (!TERMINAL.includes(job.status)) t = setTimeout(poll, job.pollAfterMs ?? 2000);
        };
        t = setTimeout(poll, job.pollAfterMs ?? 2000);
      } catch (e) {
        setErr(API_ERROR_MESSAGE[e instanceof ApiError ? e.kind : "unknown"]);
      }
    })();
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [caseId]);

  const cur = status ? FLOW.indexOf(status) : -1;
  return (
    <Page title="Acompanhamento" step="Processamento (simulado)">
      <p className="mb-6 text-muted-foreground">
        Este é o processamento desta plataforma, não o prazo de análise do INSS. Não mostramos tempo
        estimado.
      </p>
      {err && (
        <p role="alert" className="mb-4 rounded-xl bg-destructive p-4 text-destructive-foreground">
          {err}
        </p>
      )}
      <ol className="grid gap-3" aria-live="polite">
        {FLOW.map((s, i) => {
          const done = i < cur || status === "completed";
          const now = i === cur && status !== "completed";
          return (
            <li
              key={s}
              className={cn(
                "flex items-center gap-3 rounded-xl border-2 p-4 text-lg",
                now ? "border-primary bg-secondary" : "border-border bg-card",
              )}
            >
              <span aria-hidden className="w-6 text-center font-bold">
                {done ? "✓" : now ? "●" : "○"}
              </span>
              <span>{JOB_LABEL[s]}</span>
              <span className="ml-auto text-sm font-bold">
                {done ? "Feito" : now ? "Agora" : "Aguardando"}
              </span>
            </li>
          );
        })}
      </ol>
      {(status === "failed" || status === "cancelled") && (
        <p role="alert" className="mt-4 rounded-xl bg-destructive p-4 text-destructive-foreground">
          {JOB_LABEL[status]}
        </p>
      )}
      {status === "completed" && (
        <Button asChild className="mt-8 h-14 w-full text-lg">
          <Link to="/resultado">Ver relatório</Link>
        </Button>
      )}
      <p className="mt-6 text-sm text-muted-foreground">
        Sair e voltar ao caso depende do login, que ainda não está disponível.
      </p>
    </Page>
  );
}
