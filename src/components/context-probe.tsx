import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Probe, ContextStatus } from "@/lib/legal/contextual";

export function ContextProbe({ probe, onDone }: { probe: Probe; onDone: (s: ContextStatus, v: string[]) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (k: string) =>
    setSel(probe.multi ? (k === "nenhum" ? ["nenhum"] : sel.includes(k) ? sel.filter(x => x !== k) : [...sel.filter(x => x !== "nenhum"), k]) : [k]);
  return (
    <section role="dialog" aria-labelledby="probe-q" className="mt-6 rounded-2xl border-2 border-primary/30 bg-secondary p-5">
      <p className="text-lg">{probe.explanation}</p>
      <h2 id="probe-q" className="mt-4 text-xl font-semibold">{probe.question}</h2>
      <div className="mt-3 grid gap-2">
        {Object.entries(probe.options).map(([k, label]) => (
          <label key={k} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 border-input bg-card px-4 py-2 text-lg">
            <input type={probe.multi ? "checkbox" : "radio"} name={`probe-${probe.id}`} checked={sel.includes(k)} onChange={() => toggle(k)} className="h-5 w-5" />
            {label}
          </label>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">Nada é preenchido por você automaticamente. Isto é orientação preliminar, não garante o benefício.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button className="h-12 px-6 text-lg" disabled={!sel.length} onClick={() => onDone("confirmado", sel)}>Confirmar</Button>
        <Button variant="outline" className="h-12 px-6 text-lg" onClick={() => onDone("nao_sei", [])}>Não sei</Button>
        <Button variant="ghost" className="h-12 px-6 text-lg" onClick={() => onDone("pulado", [])}>Pular</Button>
      </div>
    </section>
  );
}
