import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DemoBanner() {
  return (
    <div role="note" className="bg-warning text-warning-foreground text-center text-sm font-bold px-4 py-2">
      ⚠ Ambiente de demonstração. Use somente informações fictícias.
    </div>
  );
}

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("rounded-xl border-l-4 border-primary bg-card p-4 text-base", className)}>
      Somos um assistente digital de orientação previdenciária, não um escritório de advocacia. Ajudamos você a
      entender sua situação, organizar documentos e identificar próximos passos, buscando evitar perda de tempo e
      gastos desnecessários. <strong>Não garantimos a concessão do benefício.</strong>
    </p>
  );
}

export function Page({ children, title, step }: { children: ReactNode; title?: string; step?: string }) {
  return (
    <div className="min-h-screen flex flex-col">
      <DemoBanner />
      <header className="border-b border-border">
        <div className="mx-auto max-w-2xl px-5 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="font-display text-xl font-semibold text-primary">
            IA Previdenciária INSS
          </Link>
          <Link to="/exemplos" className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground">
            Exemplos fictícios
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        {step && <p className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{step}</p>}
        {title && <h1 className="mt-1 mb-6 text-3xl sm:text-4xl font-semibold">{title}</h1>}
        {children}
      </main>
      <footer className="border-t border-border text-sm text-muted-foreground">
        <p className="mx-auto max-w-2xl px-5 py-6">
          Orientação preliminar. Não substitui advogado, médico ou perito. Sem vínculo com o INSS ou qualquer órgão
          público.
        </p>
      </footer>
    </div>
  );
}

export function ChoiceList<T extends string>({
  name,
  options,
  value,
  onChange,
  multi,
  descriptions,
  details,
  recommended,
}: {
  name: string;
  options: Record<T, string>;
  value: T | T[] | undefined;
  onChange: (v: T) => void;
  multi?: boolean;
  /** Explicação curta em linguagem simples, visível abaixo do rótulo. */
  descriptions?: Record<T, string>;
  /** "Saiba mais" acessível (details/summary nativo), opcional por opção. */
  details?: Record<T, string>;
  recommended?: T;
}) {
  const selected = (k: T) => (Array.isArray(value) ? value.includes(k) : value === k);
  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">{name}</legend>
      {(Object.keys(options) as T[]).map((k) => {
        const on = selected(k);
        const desc = descriptions?.[k];
        const detail = details?.[k];
        return (
          <label
            key={k}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 text-lg transition-colors",
              on ? "border-primary bg-secondary" : "border-border bg-card hover:border-input",
            )}
          >
            <input
              type={multi ? "checkbox" : "radio"}
              name={name}
              checked={on}
              onChange={() => onChange(k)}
              className="mt-1 size-5 accent-primary"
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                {options[k]}
                {recommended === k && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                    Recomendado
                  </span>
                )}
                {on && <span className="text-sm font-bold text-primary">✓ Selecionado</span>}
              </span>
              {desc && <span className="mt-1 block text-sm font-normal text-muted-foreground">{desc}</span>}
              {detail && (
                <details className="mt-1 text-sm font-normal">
                  <summary className="cursor-pointer text-primary underline underline-offset-2">Saiba mais</summary>
                  <p className="mt-1 text-muted-foreground">{detail}</p>
                </details>
              )}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

export function Progress({ current, total }: { current: number; total: number }) {
  return (
    <div className="mb-6">
      <p className="mb-2 text-sm font-bold">
        Pergunta {current} de {total}
      </p>
      <div className="h-2 rounded-full bg-muted" aria-hidden>
        <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(current / total) * 100}%` }} />
      </div>
    </div>
  );
}
