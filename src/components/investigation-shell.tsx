import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cloudAdapter } from "@/lib/api/cloud-adapter";
import agentImage from "@/assets/assistente-exemplos.jpg";

export function InvestigationShell({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const navigate = useNavigate();
  const client = useQueryClient();
  const router = useRouter();
  useEffect(() => {
    void cloudAdapter.user().then((user) => setSignedIn(Boolean(user)));
  }, [router.state.location.pathname]);
  const signout = async () => {
    await client.cancelQueries();
    client.clear();
    await cloudAdapter.signout();
    setSignedIn(false);
    await navigate({ to: "/auth", replace: true });
  };
  return (
    <div className="examples-experience min-h-screen flex flex-col">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 text-primary font-bold text-lg">
            <img
              src={agentImage}
              alt="Assistente previdenciária"
              className="size-12 rounded-full object-cover"
            />
            IA Previdenciária INSS
          </Link>
          <nav className="flex flex-wrap items-center gap-3">
            <Button asChild variant="ghost">
              <Link to="/exemplos">Exemplos fictícios</Link>
            </Button>
            {signedIn ? (
              <>
                <Button asChild variant="ghost">
                  <Link to="/privacidade">Privacidade e uso</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/investigacoes">Minhas investigações</Link>
                </Button>
                <Button variant="ghost" onClick={signout} title="Sair da conta">
                  <LogOut />
                  Sair
                </Button>
              </>
            ) : (
              <Button asChild variant="outline">
                <Link to="/auth">Entrar</Link>
              </Button>
            )}
          </nav>
        </div>
      </header>
      <main className="w-full mx-auto max-w-6xl flex-1 px-5 py-8">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-6 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <ShieldCheck className="size-4 shrink-0" />
            Seus documentos são privados e não alimentam uma biblioteca compartilhada.
          </p>
          <p className="mt-2">
            Orientação preliminar. Não substitui advogado, médico ou perito. Sem vínculo com o INSS.
            Não garantimos benefícios.
          </p>
        </div>
      </footer>
    </div>
  );
}
