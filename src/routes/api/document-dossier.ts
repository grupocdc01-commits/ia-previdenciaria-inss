import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/document-dossier")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { documentJson, handleDocumentModule } =
          await import("@/lib/api/document-dossier.server");
        if (process.env["DOCUMENT_DOSSIER_ENABLED"] !== "true")
          return documentJson(
            {
              error: "Conferência e relatório administrativo aguardam habilitação neste ambiente.",
            },
            503,
          );
        try {
          const { authenticateRequest } = await import("@/lib/api/request-auth.server");
          const auth = await authenticateRequest(request);
          if (!auth) return documentJson({ error: "Entre na sua conta." }, 401);
          return await handleDocumentModule(request, auth);
        } catch {
          return documentJson(
            { error: "Serviço indisponível. Suas escolhas permanecem na tela." },
            503,
          );
        }
      },
    },
  },
});
