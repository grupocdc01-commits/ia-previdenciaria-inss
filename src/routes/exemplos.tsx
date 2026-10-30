import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  MessageCircle,
  Scale,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoBanner } from "@/components/shell";
import { DEMO_CASES } from "@/lib/demo-cases";
import { LABELS, documentList, type Answers, type DocStatus } from "@/lib/case-model";
import { advanceExampleStage, type ExampleStage } from "@/lib/example-flow";
import { cn } from "@/lib/utils";
import assistant from "@/assets/assistente-exemplos.jpg";

export const Route = createFileRoute("/exemplos")({
  head: () => ({
    meta: [
      { title: "Exemplos fictícios — Orientação Previdenciária" },
      { name: "description", content: "Navegue por casos fictícios de demonstração." },
      { property: "og:title", content: "Exemplos fictícios — Orientação Previdenciária" },
      { property: "og:description", content: "Navegue por casos fictícios de demonstração." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Exemplos,
});

function Exemplos() {
  const [stage, setStage] = useState<ExampleStage>(0);
  const [selected, setSelected] = useState<string>();
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState("");
  const [answers, setAnswers] = useState<Answers>();
  const [questionStep, setQuestionStep] = useState(0);
  const demo = DEMO_CASES.find((item) => item.id === selected);
  const choose = (id: string) => {
    const item = DEMO_CASES.find((candidate) => candidate.id === id);
    if (!item) return;
    setSelected(id);
    setAnswers(structuredClone(item.answers));
    setSent(item.descricao);
  };
  const next = () => setStage((current) => advanceExampleStage(current, Boolean(demo && answers)));
  const docs = answers ? documentList(answers) : [];
  const analysis = demo?.analysis;
  const fieldClass = "mt-2 h-12 w-full rounded-md border border-input bg-card px-3 text-base";
  return (
    <div className="examples-experience min-h-screen">
      <DemoBanner />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-5">
          <Link to="/" className="flex items-center gap-2 text-primary">
            <Scale className="size-8" />
            <span className="text-lg font-bold leading-tight">
              IA Previdenciária INSS
              <span className="block text-xs font-normal">Assistente virtual</span>
            </span>
          </Link>
          <span className="text-xs font-bold text-muted-foreground">Exemplos fictícios</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-6 sm:py-8">
        <ol aria-label="Etapas do exemplo" className="mb-8 grid grid-cols-3">
          {["Conversa", "Perguntas", "Painel"].map((label, index) => (
            <li
              key={label}
              aria-current={stage === index ? "step" : undefined}
              className={cn(
                "flex items-center justify-center gap-2 border-b-2 pb-4 text-sm",
                stage >= index
                  ? "border-primary text-primary font-bold"
                  : "border-border text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full",
                  stage >= index ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {stage > index ? <Check className="size-4" /> : index + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>
        {stage === 0 && (
          <div className="mx-auto max-w-2xl">
            <div className="flex items-center gap-5 overflow-hidden border-b border-border pb-5 sm:gap-8">
              <img
                src={assistant}
                width={768}
                height={1024}
                alt="Assistente virtual ilustrativa"
                className="h-56 w-32 shrink-0 rounded-md object-cover object-top sm:h-64 sm:w-48"
              />
              <div>
                <span className="text-xs font-bold uppercase text-primary">
                  Conversa com assistente virtual
                </span>
                <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
                  Olá! Vamos entender seu caso.
                </h1>
                <p className="mt-3 text-base text-muted-foreground">
                  Me conte o que aconteceu com seu benefício.
                </p>
              </div>
            </div>
            <div className="my-5 grid grid-cols-3 gap-3 text-xs text-primary">
              {[
                [Bot, "Assistente virtual"],
                [ShieldCheck, "Orientação preliminar"],
                [MessageCircle, "Linguagem simples"],
              ].map(([Icon, label]) => {
                const Symbol = Icon as typeof Bot;
                return (
                  <div key={String(label)} className="flex items-center gap-2">
                    <Symbol className="size-5 shrink-0" />
                    <span>{String(label)}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-start gap-3">
              <Bot className="mt-3 size-6 shrink-0 text-primary" />
              <p className="rounded-lg bg-muted p-4 text-base">
                Vamos começar? Escolha um caso fictício para nossa conversa.
              </p>
            </div>
            <div className="my-4 grid gap-2 pl-9">
              {DEMO_CASES.map((item) => (
                <Button
                  key={item.id}
                  variant="outline"
                  aria-pressed={selected === item.id}
                  className={cn(
                    "h-auto min-h-14 justify-start whitespace-normal p-3 text-left",
                    selected === item.id && "border-primary bg-secondary",
                  )}
                  onClick={() => choose(item.id)}
                >
                  <FileText className="text-primary" />
                  <span className="flex-1">{item.titulo}</span>
                  <ChevronRight />
                </Button>
              ))}
            </div>
            {sent && (
              <div className="mb-4 ml-9 rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-bold text-primary">Você · exemplo fictício</p>
                <p className="mt-1">{sent}</p>
              </div>
            )}
            {demo && (
              <div className="mb-5 flex gap-3">
                <Bot className="mt-3 size-6 shrink-0 text-primary" />
                <p className="rounded-lg bg-muted p-4">
                  Vamos conferir as informações e indicar os documentos disponíveis. Você pode
                  continuar mesmo sem todos os documentos.
                </p>
              </div>
            )}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (message.trim()) {
                  setSent(message.trim());
                  setMessage("");
                }
              }}
              className="flex gap-2"
            >
              <input
                aria-label="Mensagem fictícia"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Escreva uma mensagem fictícia…"
                className="h-12 min-w-0 flex-1 rounded-md border border-input bg-card px-4"
              />
              <Button
                type="submit"
                size="icon"
                className="size-12 rounded-full"
                aria-label="Enviar mensagem"
                disabled={!message.trim() || !demo}
              >
                <Send />
              </Button>
            </form>
            <Button onClick={next} disabled={!demo} className="mt-5 h-12 w-full">
              Continuar para as perguntas <ArrowRight />
            </Button>
          </div>
        )}
        {stage === 1 && answers && (
          <div className="mx-auto max-w-2xl">
            <h1 className="text-3xl font-bold">Vamos entender o seu caso</h1>
            <p className="mt-2 text-muted-foreground">{demo?.titulo}</p>
            <div className="my-5 flex items-center gap-3 rounded-md bg-secondary p-4 text-sm">
              <Bot className="size-7 shrink-0 text-primary" />
              Exemplo fictício. Nenhuma informação ou documento é enviado para análise real.
            </div>
            <p className="mb-4 text-sm font-bold text-primary">
              {questionStep + 1} de 2 ·{" "}
              {questionStep === 0 ? "Dados do benefício" : "Documentos disponíveis"}
            </p>
            {questionStep === 0 ? (
              <div className="grid gap-5">
                <label className="font-bold">
                  Qual é o benefício?
                  <select
                    className={fieldClass}
                    value={answers.beneficio}
                    onChange={(event) =>
                      setAnswers({
                        ...answers,
                        beneficio: event.target.value as NonNullable<Answers["beneficio"]>,
                      })
                    }
                  >
                    {Object.entries(LABELS.beneficio).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="font-bold">
                  Qual é a situação do pedido?
                  <select
                    className={fieldClass}
                    value={answers.situacao}
                    onChange={(event) =>
                      setAnswers({
                        ...answers,
                        situacao: event.target.value as NonNullable<Answers["situacao"]>,
                      })
                    }
                  >
                    {Object.entries(LABELS.situacao).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="font-bold">
                    Idade
                    <input
                      className={fieldClass}
                      value={answers.idade ?? ""}
                      onChange={(event) => setAnswers({ ...answers, idade: event.target.value })}
                    />
                  </label>
                  <label className="font-bold">
                    Estado
                    <input
                      className={fieldClass}
                      maxLength={2}
                      value={answers.uf ?? ""}
                      onChange={(event) =>
                        setAnswers({ ...answers, uf: event.target.value.toUpperCase() })
                      }
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {docs.map((doc) => (
                  <label key={doc.id} className="rounded-md border border-border bg-card p-4">
                    <span className="flex items-center gap-2 font-bold">
                      <FileText className="size-5 text-primary" />
                      {doc.nome}
                    </span>
                    <span className="mt-1 block text-sm text-muted-foreground">{doc.onde}</span>
                    <select
                      aria-label={`Disponibilidade: ${doc.nome}`}
                      className={fieldClass}
                      value={answers.docStatus[doc.id] ?? "nao_sei"}
                      onChange={(event) =>
                        setAnswers({
                          ...answers,
                          docStatus: {
                            ...answers.docStatus,
                            [doc.id]: event.target.value as DocStatus,
                          },
                        })
                      }
                    >
                      <option value="disponivel">Tenho esse documento</option>
                      <option value="falta">Ainda não tenho</option>
                      <option value="nao_sei">Não sei</option>
                    </select>
                  </label>
                ))}
              </div>
            )}
            <div className="mt-6 flex justify-between gap-3">
              <Button
                variant="outline"
                className="h-12"
                onClick={() => (questionStep === 1 ? setQuestionStep(0) : setStage(0))}
              >
                <ArrowLeft />
                Voltar
              </Button>
              <Button
                className="h-12"
                onClick={() => (questionStep === 0 ? setQuestionStep(1) : next())}
              >
                {questionStep === 0 ? "Próxima etapa" : "Ver painel do exemplo"}
                <ArrowRight />
              </Button>
            </div>
          </div>
        )}
        {stage === 2 && answers && analysis && (
          <div>
            <div className="flex items-center gap-5 overflow-hidden rounded-md bg-primary text-primary-foreground p-5 sm:p-6">
              <img
                src={assistant}
                width={768}
                height={1024}
                alt="Assistente virtual ilustrativa"
                className="hidden h-36 w-28 rounded-md object-cover object-top sm:block"
              />
              <div>
                <span className="text-xs font-bold uppercase">
                  Painel de investigação · fictício
                </span>
                <h1 className="mt-1 text-3xl font-bold">Seu caso organizado</h1>
                <p className="mt-2 max-w-xl text-base">{demo?.titulo}</p>
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-5" />
                  Conversa e perguntas concluídas
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <section className="rounded-md border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold">Resumo do seu caso</h2>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setStage(1);
                      setQuestionStep(0);
                    }}
                  >
                    Editar
                  </Button>
                </div>
                <dl className="mt-3 grid gap-4">
                  {[
                    ["Benefício", LABELS.beneficio[answers.beneficio ?? "nao_sei"]],
                    ["Situação", LABELS.situacao[answers.situacao ?? "nao_sei"]],
                    [
                      "Idade / Estado",
                      `${answers.idade || "Não informada"} / ${answers.uf || "Não informado"}`,
                    ],
                  ].map(([label, value]) => (
                    <div key={label} className="flex gap-3">
                      <UserRound className="mt-1 size-5 shrink-0 text-primary" />
                      <div>
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="text-sm font-bold">{value}</dd>
                      </div>
                    </div>
                  ))}
                </dl>
              </section>
              <section className="rounded-md border border-border bg-card p-5">
                <h2 className="text-lg font-bold">Documentos do exemplo</h2>
                <ul className="mt-4 grid gap-3">
                  {docs.map((doc) => (
                    <li key={doc.id} className="flex items-start gap-2 text-sm">
                      <FileText className="size-5 shrink-0 text-primary" />
                      <span className="flex-1">{doc.nome}</span>
                      <span
                        className={cn(
                          "text-xs",
                          answers.docStatus[doc.id] === "disponivel"
                            ? "text-primary"
                            : "text-muted-foreground",
                        )}
                      >
                        {answers.docStatus[doc.id] === "disponivel"
                          ? "Disponível"
                          : answers.docStatus[doc.id] === "falta"
                            ? "Falta"
                            : "Não sei"}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  className="mt-5"
                  onClick={() => {
                    setStage(1);
                    setQuestionStep(1);
                  }}
                >
                  Revisar documentos
                </Button>
              </section>
            </div>
            <section className="mt-7 border-t border-border pt-6">
              <h2 className="text-xl font-bold">Orientação simulada do caso escolhido</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                O texto abaixo pertence ao exemplo original; alterações nas respostas não geram uma
                nova análise.
              </p>
              <p className="mt-4">{analysis.explicacao}</p>
              {analysis.urgencias.map((item) => (
                <p
                  key={item}
                  className="mt-3 rounded-md bg-warning p-3 text-sm text-warning-foreground"
                >
                  {item}
                </p>
              ))}
            </section>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <section>
                <h2 className="mb-3 text-lg font-bold">Próximos passos</h2>
                <ol className="grid gap-3">
                  {analysis.proximosPassos.map((item, index) => (
                    <li key={item} className="flex gap-3 text-sm">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-primary font-bold">
                        {index + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ol>
              </section>
              <section>
                <h2 className="mb-3 text-lg font-bold">Limites desta orientação</h2>
                <ul className="grid gap-2 text-sm text-muted-foreground">
                  {analysis.limitacoes.map((item) => (
                    <li key={item} className="flex gap-2">
                      <ShieldCheck className="size-4 shrink-0 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
            <Button
              variant="outline"
              className="mt-8 h-12"
              onClick={() => {
                setStage(0);
                setQuestionStep(0);
                setSelected(undefined);
                setAnswers(undefined);
                setSent("");
                setMessage("");
              }}
            >
              <ArrowLeft />
              Experimentar outro caso
            </Button>
          </div>
        )}
      </main>
      <footer className="mx-auto mt-8 max-w-5xl border-t border-border px-5 py-5 text-xs text-muted-foreground">
        Orientação preliminar. Não substitui advogado, médico ou perito. Sem vínculo com o INSS.
        Resultados fictícios.
      </footer>
    </div>
  );
}
