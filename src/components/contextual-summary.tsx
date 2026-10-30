import { contextualTechnical, type ContextInput } from "@/lib/legal/contextual";

export function ContextualSummary({ input }: { input: ContextInput }) {
  const items = contextualTechnical(input);
  return <ContextualItems items={items} />;
}
export function ContextualItems({ items }: { items: ReturnType<typeof contextualTechnical> }) {
  if (!items.length) return null;
  const labels = { confirmado: "Informado por você", nao_sei: "Não sei", pulado: "Pulado" };
  return (
    <section
      aria-label="Complementos da investigação"
      className="mt-6 rounded-xl border border-border p-5"
    >
      <h2 className="text-xl font-bold">Complementos da investigação</h2>
      <p className="mt-2">
        As respostas são declarações, não fatos comprovados. Documentos e fontes ainda precisam de
        conferência.
      </p>
      <ul className="mt-4 space-y-4">
        {items.map((item) => (
          <li key={item.probe}>
            <h3 className="font-bold">{item.fact}</h3>
            <p>{labels[item.answer]}</p>
            {item.values.length > 0 && <p>{item.values.join("; ")}</p>}
            <p className="mt-1 text-sm">{item.caveat}</p>
            <details className="mt-2">
              <summary>Referências para conferência</summary>
              <ul>
                {item.basis.map((basis) => (
                  <li key={`${basis.title}-${basis.ref}`}>
                    <a
                      className="text-primary underline"
                      href={basis.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {basis.title} — {basis.ref}
                    </a>
                    <p>
                      Revisão: {basis.review}.{" "}
                      {basis.usable
                        ? "Referência revisada; não é conclusão sobre o caso."
                        : "Não liberada para conclusões jurídicas."}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
