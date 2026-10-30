import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChoiceList, Page, Progress } from "@/components/shell";
import { useCase } from "@/lib/case-store";
import { LABELS, TRABALHO_LABELS, UFS, type Answers, type DocInicial } from "@/lib/case-model";
import { ContextProbe } from "@/components/context-probe";
import { probeForStep, recordProbe } from "@/lib/legal/contextual";

export const Route = createFileRoute("/questionario")({
  head: () => ({
    meta: [
      { title: "Questionário inicial — Orientação Previdenciária" },
      { name: "description", content: "Perguntas curtas para entender seu caso." },
      { property: "og:title", content: "Questionário inicial — Orientação Previdenciária" },
      { property: "og:description", content: "Perguntas curtas para entender seu caso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Questionario,
});

interface Step {
  key?: string;
  title: string;
  render: () => ReactNode;
  ok: boolean;
}

function Questionario() {
  const { answers: a, setAnswers } = useCase();
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const up = (p: Partial<Answers>) => setAnswers((x) => ({ ...x, ...p }));

  const steps: Step[] = [
    { title: "Para quem é o atendimento?", ok: !!a.paraQuem, render: () => <ChoiceList name="paraQuem" options={LABELS.paraQuem} value={a.paraQuem} onChange={(v) => up({ paraQuem: v })} /> },
    { key: "beneficio", title: "Você já sabe qual benefício procura?", ok: !!a.beneficio, render: () => <ChoiceList name="beneficio" options={LABELS.beneficioPergunta} descriptions={LABELS.beneficioExplicacao} details={LABELS.beneficioDetalhe} recommended="nao_sei" value={a.beneficio} onChange={(v) => up({ beneficio: v })} /> },
    { key: "situacao", title: "Qual a situação do pedido?", ok: !!a.situacao, render: () => <ChoiceList name="situacao" options={LABELS.situacao} value={a.situacao} onChange={(v) => up({ situacao: v })} /> },
  ];
  if (a.situacao === "negado")
    steps.push({
      title: "Quando você recebeu a comunicação da negativa?",
      ok: true,
      render: () => (
        <div className="grid gap-3">
          <label htmlFor="dn" className="font-bold">Data em que recebeu</label>
          <input id="dn" type="date" value={a.dataNegativa ?? ""} onChange={(e) => up({ dataNegativa: e.target.value })} className="h-14 rounded-xl border-2 border-input bg-card px-4 text-lg" />
          <Button variant="outline" className="h-12 w-fit" onClick={() => up({ dataNegativa: "" })}>Não sei</Button>
        </div>
      ),
    });
  if (a.situacao === "exigencia")
    steps.push({
      title: "O que diz a comunicação de exigência?",
      ok: true,
      render: () => (
        <div className="grid gap-2">
          <label htmlFor="ex" className="font-bold">Copie ou resuma o texto (use apenas informações fictícias)</label>
          <textarea id="ex" rows={5} value={a.comunicacaoExigencia ?? ""} onChange={(e) => up({ comunicacaoExigencia: e.target.value })} className="rounded-xl border-2 border-input bg-card p-4 text-lg" />
          <p className="text-sm text-muted-foreground">Se não tiver, deixe em branco. Vamos indicar como conseguir.</p>
        </div>
      ),
    });
  steps.push({
    title: "Idade da pessoa e estado onde mora",
    ok: !!a.idade && !!a.uf,
    render: () => (
      <div className="grid gap-5">
        <div className="grid gap-2">
          <label htmlFor="idade" className="font-bold">Idade (em anos)</label>
          <div className="flex gap-3">
            <input id="idade" inputMode="numeric" value={a.idade === "Não sei" ? "" : a.idade ?? ""} onChange={(e) => up({ idade: e.target.value.replace(/\D/g, "").slice(0, 3) })} className="h-14 w-32 rounded-xl border-2 border-input bg-card px-4 text-lg" />
            <Button variant={a.idade === "Não sei" ? "default" : "outline"} className="h-14" onClick={() => up({ idade: "Não sei" })}>Não sei</Button>
          </div>
        </div>
        <div className="grid gap-2">
          <label htmlFor="uf" className="font-bold">Estado</label>
          <select id="uf" value={a.uf ?? ""} onChange={(e) => up({ uf: e.target.value })} className="h-14 rounded-xl border-2 border-input bg-card px-4 text-lg">
            <option value="">Selecione</option>
            {UFS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
      </div>
    ),
  });
  steps.push({
    key: "trabalho",
    title: "Como foi o trabalho da pessoa ao longo da vida?",
    ok: (a.trabalhos ?? []).length > 0,
    render: () => (
      <ChoiceList
        name="trabalhos"
        multi
        options={TRABALHO_LABELS}
        value={(a.trabalhos ?? []) as (keyof typeof TRABALHO_LABELS)[]}
        onChange={(v) => {
          const t = a.trabalhos ?? [];
          const solo = v === "nunca" || v === "nao_sei";
          up({ trabalhos: solo ? [v] : t.includes(v) ? t.filter((d) => d !== v) : [...t.filter((d) => d !== "nunca" && d !== "nao_sei"), v] });
        }}
      />
    ),
  });
  steps.push({
    title: "Quais documentos você possui?",
    ok: a.docs.length > 0,
    render: () => (
      <ChoiceList
        name="docs"
        multi
        options={LABELS.docs}
        value={a.docs}
        onChange={(v: DocInicial) =>
          up({
            docs: v === "nenhum" ? ["nenhum"] : a.docs.includes(v) ? a.docs.filter((d) => d !== v) : [...a.docs.filter((d) => d !== "nenhum"), v],
          })
        }
      />
    ),
  });

  const idx = Math.min(i, steps.length - 1);
  const s = steps[idx]!;
  const last = idx === steps.length - 1;
  const [probing, setProbing] = useState(false);
  const probe = s.key ? probeForStep(a, s.key) : undefined;
  const advance = () => (last ? nav({ to: "/perguntas" }) : setI(idx + 1));
  const next = () => (probe ? setProbing(true) : advance());

  return (
    <Page step="Questionário inicial">
      <Progress current={idx + 1} total={steps.length} />
      <h1 className="mb-6 text-3xl font-semibold">{s.title}</h1>
      {s.render()}
      {probing && probe && (
        <ContextProbe key={probe.id} probe={probe} onDone={(st, v) => { setAnswers((x) => recordProbe(x, probe, st, v)); setProbing(false); advance(); }} />
      )}
      <p className="mt-6 text-sm text-muted-foreground">Estas informações são declaradas por você e não estão comprovadas.</p>
      <div className="mt-8 flex justify-between gap-3">
        <Button variant="outline" className="h-14 px-6 text-lg" disabled={idx === 0} onClick={() => { setProbing(false); setI(idx - 1); }}>← Voltar</Button>
        <Button className="h-14 px-8 text-lg" disabled={!s.ok || probing} onClick={next}>
          {last ? "Continuar" : "Próxima →"}
        </Button>
      </div>
    </Page>
  );
}