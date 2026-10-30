import { useChat } from "@ai-sdk/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import { cloudAdapter } from "@/lib/api/cloud-adapter";
import { BENEFITS, interviewQuestions, scopeNotice } from "@/lib/investigation";
import type { getInvestigation } from "@/lib/api/investigation.functions";
import { InvestigationAudio } from "./investigation-audio";
import { InvestigationDocuments } from "./investigation-documents";
import agentImage from "@/assets/assistente-exemplos.jpg";

type Thread = Awaited<ReturnType<typeof getInvestigation>>;
export function InvestigationChat({ thread }: { thread: Thread }) {
  const transport = useMemo(() => cloudAdapter.transport(thread.id), [thread.id]);
  const client = useQueryClient();
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  const [draft, setDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const collecting = thread.facts.storyStatus === "collecting";
  const chat = useChat({
    id: thread.id,
    messages: thread.messages,
    transport,
    onFinish: async () => {
      await client.invalidateQueries({ queryKey: ["private-investigation", thread.id] });
      await client.invalidateQueries({ queryKey: ["private-investigations"] });
    },
  });
  const busy = chat.status === "submitted" || chat.status === "streaming";
  useEffect(() => {
    if (!busy && !document.querySelector('[role="dialog"]')) textarea.current?.focus();
  }, [busy, thread.id]);
  const send = async (text: string, finishStory = false) => {
    if (!text.trim() || busy || recording) return;
    setDraft("");
    textarea.current?.focus();
    await chat.sendMessage({ text }, { body: { finishStory } });
  };
  const count = Object.keys(thread.facts.answers).length + (thread.benefit ? 1 : 0);
  const total = interviewQuestions(thread.benefit).length + 1;
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        <img
          src={agentImage}
          alt="Assistente previdenciária"
          className="size-14 rounded-full object-cover"
        />
        <div>
          <h1 className="text-2xl font-bold">Sua investigação</h1>
          <p className="text-sm text-muted-foreground">Atendimento privado · Triagem inicial</p>
        </div>
      </div>
      <div className="mt-5">
        <label className="text-sm font-bold" htmlFor="interview-progress">
          Informações reunidas: {Math.min(count, total)} de {total}
        </label>
        <progress
          id="interview-progress"
          max={total}
          value={Math.min(count, total)}
          className="mt-2 h-2 w-full accent-primary"
        />
      </div>
      {thread.benefit && (
        <p className="mt-3 text-sm border-l-4 border-warning pl-3">{scopeNotice(thread.benefit)}</p>
      )}
      <Conversation className="mt-5 h-[min(55vh,620px)] min-h-64 border-b border-border">
        <ConversationContent className="px-0 py-4 gap-6">
          {chat.messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent
                className={
                  message.role === "user" ? "bg-primary text-primary-foreground text-lg" : "text-lg"
                }
              >
                {message.parts.map((part, index) =>
                  part.type === "text" ? (
                    <MessageResponse key={index}>{part.text}</MessageResponse>
                  ) : null,
                )}
              </MessageContent>
            </Message>
          ))}
          {chat.status === "submitted" && (
            <div role="status">
              <Shimmer>
                {collecting
                  ? "Salvando seu relato…"
                  : "A assistente está preparando a próxima pergunta…"}
              </Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton aria-label="Ir para a última mensagem" />
      </Conversation>
      {!collecting && !thread.benefit && (
        <div className="grid sm:grid-cols-2 gap-2 my-4">
          {BENEFITS.map((benefit) => (
            <Button
              key={benefit}
              variant="outline"
              className="h-auto min-h-12 justify-start whitespace-normal text-left text-base"
              disabled={busy || recording}
              onClick={() => send(benefit)}
            >
              {benefit}
            </Button>
          ))}
        </div>
      )}
      {chat.error && (
        <p role="alert" className="mt-3 text-destructive">
          {chat.error.message}
        </p>
      )}
      <PromptInput onSubmit={({ text }) => send(text)} className="mt-4">
        <PromptInputTextarea
          ref={textarea}
          aria-label="Sua resposta"
          placeholder="Conte com suas palavras…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-24 text-lg"
        />
        <PromptInputFooter className="justify-end">
          <PromptInputSubmit
            status={chat.status}
            onStop={() => chat.stop()}
            disabled={recording || (!busy && !draft.trim())}
            className="size-12"
            aria-label={busy ? "Interromper resposta" : "Enviar resposta"}
          />
        </PromptInputFooter>
      </PromptInput>
      {collecting && (
        <Button
          type="button"
          className="mt-3 min-h-12"
          disabled={busy || recording || (!draft.trim() && thread.facts.story.length === 0)}
          onClick={() => send(draft.trim() || "Terminei de contar.", true)}
        >
          Terminei de contar
        </Button>
      )}
      <InvestigationAudio
        disabled={busy}
        onActiveChange={setRecording}
        onTranscript={(text) => {
          setDraft(text);
          textarea.current?.focus();
        }}
      />
      <InvestigationDocuments threadId={thread.id} />
      <div className="mt-6">
        <Button asChild className="min-h-12 h-auto py-3 whitespace-normal">
          <Link to="/investigacao/$threadId/painel" params={{ threadId: thread.id }}>
            Ver informações da investigação
          </Link>
        </Button>
      </div>
    </div>
  );
}
