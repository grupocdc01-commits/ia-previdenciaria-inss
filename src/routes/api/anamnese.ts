import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/anamnese")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { anamnesisJson, handleAnamnesisRequest } =
          await import("@/lib/api/anamnesis.server");
        if (process.env["ANAMNESIS_V2_ENABLED"] !== "true")
          return anamnesisJson(
            { error: "A anamnese estruturada ainda não foi habilitada neste ambiente." },
            503,
          );
        const { authenticateRequest } = await import("@/lib/api/request-auth.server");
        try {
          const auth = await authenticateRequest(request);
          if (!auth) return anamnesisJson({ error: "Entre na sua conta para continuar." }, 401);
          return await handleAnamnesisRequest(request, auth);
        } catch {
          return anamnesisJson(
            { error: "Atendimento indisponível. Sua resposta permanece na tela." },
            503,
          );
        }
      },
    },
  },
});
