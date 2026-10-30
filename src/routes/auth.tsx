import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { InvestigationShell } from "@/components/investigation-shell";
import { cloudAdapter } from "@/lib/api/cloud-adapter";
import "@lovable.dev/cloud-auth-js/styles.css";
import { friendlyAuthError } from "@/lib/auth-messages";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acesso privado — Investigação INSS" },
      {
        name: "description",
        content: "Entre para retomar suas investigações e documentos privados.",
      },
      { property: "og:title", content: "Acesso privado — Investigação INSS" },
      {
        property: "og:description",
        content: "Acesso protegido às suas investigações previdenciárias.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Auth,
});
function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    void cloudAdapter.user().then((user) => {
      if (user) void navigate({ to: "/investigacoes" });
    });
  }, [navigate]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      if (mode === "reset") {
        await cloudAdapter.resetPassword(email);
        setNotice(
          "Se a conta existir, você receberá um link para criar uma nova senha. Confira também o spam.",
        );
      } else if (mode === "signup") {
        const signed = await cloudAdapter.signup(email, password, name);
        if (signed) await navigate({ to: "/investigacoes" });
        else
          setNotice(
            "Confira seu e-mail para confirmar a conta. Depois, entre para iniciar a investigação.",
          );
      } else {
        await cloudAdapter.login(email, password);
        await navigate({ to: "/investigacoes" });
      }
    } catch (error) {
      setNotice(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  };
  const social = async (provider: "google" | "lovable") => {
    setBusy(true);
    setNotice("");
    try {
      const redirected = await cloudAdapter.social(provider);
      if (!redirected) await navigate({ to: "/investigacoes" });
    } catch (error) {
      setNotice(friendlyAuthError(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <InvestigationShell>
      <div className="mx-auto max-w-md py-8">
        <h1 className="text-3xl font-bold">
          {mode === "signup"
            ? "Criar minha conta"
            : mode === "reset"
              ? "Recuperar minha senha"
              : "Entrar na minha conta"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          Seu atendimento e seus documentos ficam acessíveis somente na sua conta.
        </p>
        <form onSubmit={submit} className="mt-6 grid gap-4">
          {mode === "signup" && (
            <label className="grid gap-2">
              Seu nome
              <input
                className="h-12 rounded-md border border-input bg-background px-3"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>
          )}
          <label className="grid gap-2">
            E-mail
            <input
              className="h-12 rounded-md border border-input bg-background px-3"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          {mode !== "reset" && (
            <label className="grid gap-2">
              Senha
              <input
                className="h-12 rounded-md border border-input bg-background px-3"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
              />
            </label>
          )}
          <Button disabled={busy} className="h-14 text-lg">
            {busy
              ? "Aguarde…"
              : mode === "signup"
                ? "Criar conta"
                : mode === "reset"
                  ? "Enviar link"
                  : "Entrar"}
          </Button>
        </form>
        {notice && (
          <p role="status" className="mt-4 border-l-4 border-warning bg-muted p-4">
            {notice}
          </p>
        )}
        {mode !== "reset" && (
          <div className="mt-5 grid gap-3">
            <Button
              disabled={busy}
              variant="outline"
              className="h-12"
              onClick={() => social("google")}
            >
              Continuar com Google
            </Button>
            <Button
              disabled={busy}
              className="lovable-auth-button"
              onClick={() => social("lovable")}
            >
              Continue with Lovable
            </Button>
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            variant="link"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setNotice("");
            }}
          >
            {mode === "signup" ? "Já tenho uma conta" : "Criar conta"}
          </Button>
          <Button
            variant="link"
            onClick={() => {
              setMode(mode === "reset" ? "login" : "reset");
              setNotice("");
            }}
          >
            {mode === "reset" ? "Voltar para entrar" : "Esqueci minha senha"}
          </Button>
        </div>
      </div>
    </InvestigationShell>
  );
}
