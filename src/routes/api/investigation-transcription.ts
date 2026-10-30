import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/investigation-transcription")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { authenticateRequest } = await import("@/lib/api/request-auth.server");
        const auth = await authenticateRequest(request);
        if (!auth) return new Response("Entre na sua conta para transcrever.", { status: 401 });
        const form = await request.formData();
        const audio = form.get("audio");
        if (!(audio instanceof File) || !audio.type.startsWith("audio/") || !audio.size)
          return new Response("Áudio inválido.", { status: 400 });
        try {
          const { transcribeAudio } = await import("@lovable.dev/ai-gateway");
          const result = await transcribeAudio(
            { model: "openai/gpt-transcribe", file: audio, language: "pt" },
            { signal: request.signal },
          );
          return Response.json(
            { text: typeof result === "string" ? result : result.text },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch {
          return Response.json(
            {
              error:
                "A transcrição não está disponível neste momento. Nenhum texto foi simulado; você pode escrever sua resposta.",
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
