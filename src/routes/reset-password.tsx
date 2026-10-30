import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { cloudAdapter } from "@/lib/api/cloud-adapter";
import { Button } from "@/components/ui/button";
import { InvestigationShell } from "@/components/investigation-shell";
export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nova senha — Investigação INSS" },
      { name: "description", content: "Recupere o acesso privado à sua investigação." },
      { property: "og:title", content: "Nova senha — Investigação INSS" },
      { property: "og:description", content: "Crie uma nova senha para sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});
function Reset() {
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setValid(new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery");
  }, []);
  return (
    <InvestigationShell>
      <div className="mx-auto max-w-md">
        <h1 className="text-3xl font-bold">Criar nova senha</h1>
        {valid ? (
          <form
            className="mt-6 grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await cloudAdapter.updatePassword(password);
                setNotice("Senha atualizada. Você já pode entrar na sua conta.");
              } catch (error) {
                setNotice(error instanceof Error ? error.message : "Não foi possível atualizar.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="grid gap-2">
              Nova senha
              <input
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 border border-input rounded-md px-3 bg-background"
              />
            </label>
            <Button className="h-12" disabled={busy}>
              Salvar nova senha
            </Button>
          </form>
        ) : (
          <p className="mt-6">
            Abra o link de recuperação recebido por e-mail. Se ele expirou, solicite outro.
          </p>
        )}
        {notice && (
          <p role="status" className="mt-4">
            {notice}
          </p>
        )}
        <Button asChild variant="link" className="mt-4">
          <Link to="/auth">Voltar para entrar</Link>
        </Button>
      </div>
    </InvestigationShell>
  );
}
