import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Page, Progress } from "@/components/shell";
import { useCase } from "@/lib/case-store";
import { adaptedQuestions } from "@/lib/case-model";

export const Route = createFileRoute("/perguntas")({
  head: () => ({
    meta: [
      { title: "Perguntas sobre o caso — Orientação Previdenciária" },
      { name: "description", content: "Perguntas adaptadas à sua situação." },
      { property: "og:title", content: "Perguntas sobre o caso — Orientação Previdenciária" },
      { property: "og:description", content: "Perguntas adaptadas à sua situação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Perguntas,
});

function Perguntas() {
  const { answers: a, setAnswers } = useCase();
  const nav = useNavigate();
  const qs = adaptedQuestions(a);
  const [i, setI] = useState(0);

  if (qs.length === 0)
    return (
      <Page title="Sem perguntas extras" step="Perguntas adaptadas">
        <p>Para este caso não há perguntas adicionais agora.</p>
        <Button asChild className="mt-6 h-14 px-8 text-lg"><Link to="/documentos">Ir para documentos</Link></Button>
      </Page>
    );

  const q = qs[Math.min(i, qs.length - 1)]!;
  const val = a.adaptadas[q.id] ?? "";
  const set = (v: string) => setAnswers((x) => ({ ...x, adaptadas: { ...x.adaptadas, [q.id]: v } }));
  const last = i >= qs.length - 1;

  return (
    <Page step={q.bloco}>
      <Progress current={i + 1} total={qs.length} />
      <h1 className="mb-3 text-3xl font-semibold"><label htmlFor="r">{q.pergunta}</label></h1>
      {q.ajuda && <p className="mb-4 text-muted-foreground">{q.ajuda}</p>}
      <textarea id="r" rows={5} value={val === "Não sei" ? "" : val} onChange={(e) => set(e.target.value)} className="w-full rounded-xl border-2 border-input bg-card p-4 text-lg" />
      <Button variant={val === "Não sei" ? "default" : "outline"} className="mt-3 h-12" onClick={() => set("Não sei")}>Não sei</Button>
      <p className="mt-4 text-sm text-muted-foreground">Um diagnóstico sozinho não garante nem impede o benefício. Conte como a condição afeta o dia a dia.</p>
      <div className="mt-8 flex justify-between gap-3">
        <Button variant="outline" className="h-14 px-6 text-lg" onClick={() => (i === 0 ? nav({ to: "/questionario" }) : setI(i - 1))}>← Voltar</Button>
        <Button className="h-14 px-8 text-lg" onClick={() => (last ? nav({ to: "/documentos" }) : setI(i + 1))}>{last ? "Continuar" : "Próxima →"}</Button>
      </div>
    </Page>
  );
}
