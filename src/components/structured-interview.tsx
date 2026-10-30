import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { ContextProbe } from "./context-probe";
import { InvestigationAudio } from "./investigation-audio";
import { ContextualSummary } from "./contextual-summary";
import { cloudAdapter } from "@/lib/api/cloud-adapter";
import { anamnesisQuestions, contextInput, type InterviewQuestion } from "@/lib/anamnesis";
import { BENEFITS, type InterviewAction } from "@/lib/anamnesis-schema";
import { probeById } from "@/lib/legal/contextual";
import { legalToday } from "@/lib/legal/catalog-schema";
import type { getInvestigation } from "@/lib/api/investigation.functions";

type Thread = Awaited<ReturnType<typeof getInvestigation>>;
type Submit = (action: InterviewAction) => Promise<void>;

export function StructuredInterview({ thread }: { thread: Thread }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<InterviewQuestion | null>(null);
  const inFlight = useRef(false);
  const attempt = useRef<{ key: string; requestId: string } | null>(null);
  const session = thread.anamnesis;
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["private-investigation", thread.id] });
    await client.invalidateQueries({ queryKey: ["private-panel", thread.id] });
    await client.invalidateQueries({ queryKey: ["private-investigations"] });
  };
  const submit: Submit = async (action) => {
    if (inFlight.current || recording) return;
    const key = JSON.stringify({ version: thread.updated_at, action });
    if (!attempt.current || attempt.current.key !== key)
      attempt.current = { key, requestId: crypto.randomUUID() };
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await cloudAdapter.submitAnamnesis({
        threadId: thread.id,
        requestId: attempt.current.requestId,
        expectedUpdatedAt: thread.updated_at,
        action,
      });
      await refresh();
      setEditing(null);
      attempt.current = null;
    } catch {
      setError(
        "Não foi possível concluir o envio. Seu preenchimento permanece na tela. Tente novamente ou atualize as perguntas se a investigação mudou.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  if (!session)
    return <p role="alert">Não foi possível recuperar a etapa atual. Reabra a investigação.</p>;
  const current = editing ?? session.current;
  const blocked = busy || recording;
  const edit = (key: string) => {
    const question =
      key === "benefit"
        ? {
            key,
            label:
              "Qual benefício você procura? Mudar o benefício reinicia as respostas dependentes, preservando o relato.",
            type: "choices" as const,
            options: Object.fromEntries(BENEFITS.map((benefit) => [benefit, benefit])),
          }
        : anamnesisQuestions(thread.benefit, thread.facts).find((item) => item.key === key);
    if (question) setEditing(question);
  };
  return (
    <section aria-label="Anamnese estruturada">
      <h1 className="text-2xl font-bold">Sua investigação — uma pergunta por vez</h1>
      <p className="mt-3">
        Você pode confirmar o que informa, escolher Não sei ou pular. Nenhuma resposta será tratada
        como prova ou conclusão jurídica.
      </p>
      {error && (
        <div role="alert" className="mt-4">
          <p>{error}</p>
          <Button variant="outline" disabled={blocked} onClick={() => void refresh()}>
            Atualizar perguntas (descarta edição não enviada)
          </Button>
        </div>
      )}
      {session.phase === "story" ? (
        <StoryForm
          key={thread.updated_at}
          disabled={busy}
          hasStory={thread.facts.story.length > 0}
          onRecording={setRecording}
          submit={submit}
        />
      ) : current ? (
        <AnswerForm
          key={`${current.key}-${thread.updated_at}-${editing ? "edit" : "new"}`}
          question={current}
          revising={!!editing}
          disabled={busy}
          onRecording={setRecording}
          submit={submit}
        />
      ) : (
        <p role="status" className="mt-5 rounded-xl bg-warning p-4">
          A coleta desta etapa terminou. Nenhuma conclusão jurídica foi liberada; revise as lacunas
          e as declarações.
        </p>
      )}
      {editing && (
        <Button variant="ghost" disabled={blocked} onClick={() => setEditing(null)}>
          Cancelar revisão
        </Button>
      )}
      {session.notices.map((notice) => (
        <p role="status" className="mt-3" key={notice}>
          {notice}
        </p>
      ))}
      {thread.facts.story.length > 0 && (
        <details className="mt-5">
          <summary>Relato informado por você</summary>
          {thread.facts.story.map((text, index) => (
            <p className="mt-2 whitespace-pre-wrap" key={index}>
              {text}
            </p>
          ))}
        </details>
      )}
      <h2 className="mt-6 text-xl font-bold">Declarações para revisão</h2>
      <ul className="mt-3 space-y-3">
        {session.declarations.map((item) => (
          <li key={item.key}>
            <strong>{item.question}</strong>
            <p>{item.answer}</p>
            <p className="text-sm">Declaração, não comprovação.</p>
            <Button
              variant="outline"
              disabled={blocked || session.phase === "story"}
              onClick={() => edit(item.key)}
            >
              Revisar: {item.question}
            </Button>
          </li>
        ))}
      </ul>
      <ContextualSummary input={contextInput(thread.benefit, thread.facts)} />
      {session.contextual.map((item) => (
        <Button
          key={item.probe}
          variant="outline"
          disabled={blocked}
          className="mt-2"
          onClick={() => {
            const probe = probeById(item.probe)!;
            setEditing({
              key: `context:${probe.id}`,
              label: probe.question,
              type: "context",
              options: probe.options,
              multi: probe.multi,
              probe,
            });
          }}
        >
          Revisar complemento: {item.fact}
        </Button>
      ))}
      <p className="mt-5">
        <a
          className="text-primary underline"
          href={`/investigacao/${encodeURIComponent(thread.id)}/painel`}
          aria-disabled={blocked}
          onClick={(event) => {
            if (blocked) event.preventDefault();
          }}
        >
          Ver painel e documentos da investigação
        </a>
      </p>
      <p className="mt-2 text-sm">O painel mostra apenas respostas já enviadas.</p>
      {session.missing.length > 0 && (
        <details className="mt-5">
          <summary>Informações pendentes, desconhecidas ou puladas</summary>
          <ul>
            {session.missing.map((item) => (
              <li key={item.question}>
                {item.question}:{" "}
                {item.status === "nao_sei"
                  ? "Não sei"
                  : item.status === "pulado"
                    ? "Pulado"
                    : "Pendente"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function StoryForm({
  disabled,
  hasStory,
  onRecording,
  submit,
}: {
  disabled: boolean;
  hasStory: boolean;
  onRecording: (active: boolean) => void;
  submit: Submit;
}) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const blocked = disabled || recording || text.length > 4000;
  return (
    <section className="mt-5 rounded-xl border border-border p-5">
      <h2 className="text-xl font-bold">Primeiro, conte sua história</h2>
      <p>
        Use até 4000 caracteres por trecho. Não inclua CPF, nomes de terceiros, diagnósticos ou
        laudos. Só começaremos as perguntas quando você confirmar que terminou.
      </p>
      <label className="mt-3 block">
        Seu relato
        <textarea
          className="mt-2 w-full rounded border border-input bg-background p-3"
          rows={5}
          maxLength={4000}
          value={text}
          disabled={disabled || recording}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      {text.length > 4000 && (
        <p role="alert">Revise o texto transcrito para ficar em até 4000 caracteres.</p>
      )}
      <Button
        className="mt-3 mr-3"
        disabled={blocked || !text.trim()}
        onClick={() => void submit({ kind: "story", text, finish: false })}
      >
        Salvar trecho e continuar contando
      </Button>
      <Button
        className="mt-3"
        disabled={blocked || (!text.trim() && !hasStory)}
        onClick={() => void submit({ kind: "story", text, finish: true })}
      >
        Terminei de contar
      </Button>
      <InvestigationAudio
        disabled={disabled}
        onActiveChange={(value) => {
          setRecording(value);
          onRecording(value);
        }}
        onTranscript={setText}
      />
    </section>
  );
}

function AnswerForm({
  question,
  revising,
  disabled,
  onRecording,
  submit,
}: {
  question: InterviewQuestion;
  revising: boolean;
  disabled: boolean;
  onRecording: (active: boolean) => void;
  submit: Submit;
}) {
  const [text, setText] = useState("");
  const [values, setValues] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const blocked = disabled || recording;
  const answer = (response: Extract<InterviewAction, { kind: "answer" }>["response"]) =>
    submit({ kind: revising ? "revise" : "answer", questionId: question.key, response });
  if (question.type === "context" && question.probe)
    return (
      <ContextProbe
        probe={question.probe}
        disabled={blocked}
        onDone={async (status, selected) => {
          await answer(status === "confirmado" ? { status, values: selected } : { status });
        }}
      />
    );
  const toggle = (value: string) =>
    setValues((previous) =>
      !question.multi || value === "nenhum" || value === "nunca"
        ? [value]
        : previous.includes(value)
          ? previous.filter((key) => key !== value)
          : [...previous.filter((key) => key !== "nenhum" && key !== "nunca"), value],
    );
  return (
    <form
      className="mt-5 rounded-xl border border-border p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!blocked)
          void answer(
            question.options
              ? { status: "confirmado", values }
              : { status: "confirmado", value: text },
          );
      }}
    >
      <fieldset disabled={blocked}>
        <legend className="text-xl font-bold">{question.label}</legend>
        {question.help && <p>{question.help}</p>}
        {question.options ? (
          <div className="mt-3 grid gap-2">
            {Object.entries(question.options).map(([value, label]) => (
              <label className="flex gap-3 rounded border border-input p-3" key={value}>
                <input
                  type={question.multi ? "checkbox" : "radio"}
                  name={question.key}
                  checked={values.includes(value)}
                  onChange={() => toggle(value)}
                />
                {label}
              </label>
            ))}
          </div>
        ) : (
          <label className="mt-3 block">
            Sua resposta
            {question.type === "text" ? (
              <textarea
                className="mt-2 w-full rounded border border-input bg-background p-3"
                rows={4}
                maxLength={4000}
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            ) : (
              <input
                className="mt-2 w-full rounded border border-input bg-background p-3"
                type={question.type}
                min={question.type === "number" ? 0 : undefined}
                max={question.type === "number" ? 120 : legalToday()}
                value={text}
                required
                onChange={(event) => setText(event.target.value)}
              />
            )}
          </label>
        )}
      </fieldset>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={
            blocked || (question.options ? !values.length : !text.trim() || text.length > 4000)
          }
        >
          Confirmar resposta
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={blocked}
          onClick={() => void answer({ status: "nao_sei" })}
        >
          Não sei
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={blocked}
          onClick={() => void answer({ status: "pulado" })}
        >
          Pular
        </Button>
      </div>
      {question.type === "text" && (
        <InvestigationAudio
          disabled={disabled}
          onActiveChange={(value) => {
            setRecording(value);
            onRecording(value);
          }}
          onTranscript={setText}
        />
      )}
    </form>
  );
}
