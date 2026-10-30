import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { InvestigationShell } from "@/components/investigation-shell";
import { LegalLibraryResults } from "@/components/legal-library";
import { Button } from "@/components/ui/button";
import { cloudAdapter } from "@/lib/api/cloud-adapter";
import { legalToday } from "@/lib/legal/catalog-schema";

export function LegalLibraryPage() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"todas" | "legislacao" | "jurisprudencia">("todas");
  const [onDate, setOnDate] = useState(legalToday);
  const [filters, setFilters] = useState({ query, kind, onDate, offset: 0, limit: 5 });
  const result = useQuery({
    queryKey: ["legal-library", filters],
    queryFn: () => cloudAdapter.legalLibrary({ data: filters }),
    retry: false,
  });
  const search = (event: FormEvent) => {
    event.preventDefault();
    setFilters({ query, kind, onDate, offset: 0, limit: 5 });
  };
  return (
    <InvestigationShell>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold">Base jurídica e jurisprudência</h1>
        <p className="mt-3">
          Consulte a origem das referências e o que ainda precisa de conferência. A base não está
          homologada para concluir direitos ou calcular benefícios.
        </p>
        <form onSubmit={search} className="mt-6 grid gap-4 rounded-xl border border-border p-5">
          <label className="grid gap-2">
            Buscar norma, artigo ou precedente
            <input
              className="rounded border border-input bg-background p-3"
              value={query}
              maxLength={120}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="grid gap-2">
            Tipo
            <select
              className="rounded border border-input bg-background p-3"
              value={kind}
              onChange={(event) => setKind(event.target.value as typeof kind)}
            >
              <option value="todas">Todas as referências</option>
              <option value="legislacao">Legislação</option>
              <option value="jurisprudencia">Jurisprudência</option>
            </select>
          </label>
          <label className="grid gap-2">
            Data de referência
            <input
              className="rounded border border-input bg-background p-3"
              type="date"
              required
              value={onDate}
              onChange={(event) => setOnDate(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={result.isFetching}>
            Buscar referências
          </Button>
        </form>
        {result.isPending && (
          <p role="status" className="mt-5">
            Carregando referências…
          </p>
        )}
        {result.isError && (
          <div role="alert" className="mt-5">
            <p>Não foi possível consultar a biblioteca. Nenhuma referência foi liberada.</p>
            <Button onClick={() => void result.refetch()}>Tentar novamente</Button>
          </div>
        )}
        {result.data && !result.isError && (
          <>
            <LegalLibraryResults data={result.data} />
            <nav aria-label="Paginação da biblioteca" className="mt-5 flex gap-3">
              <Button
                variant="outline"
                disabled={filters.offset === 0 || result.isFetching}
                onClick={() =>
                  setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) })
                }
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                disabled={filters.offset + filters.limit >= result.data.total || result.isFetching}
                onClick={() => setFilters({ ...filters, offset: filters.offset + filters.limit })}
              >
                Próxima
              </Button>
            </nav>
          </>
        )}
      </div>
    </InvestigationShell>
  );
}
