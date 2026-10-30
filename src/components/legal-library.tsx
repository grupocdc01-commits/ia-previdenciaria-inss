import type { LegalLibraryResult } from "@/lib/legal/catalog";

const BLOCKERS: Record<string, string> = {
  data_referencia_futura: "Não antecipamos a vigência de normas em uma data futura.",
  captura_ausente: "Texto oficial ainda não capturado.",
  identidade_nao_conferida:
    "A identidade e a integridade documental ainda precisam de conferência.",
  revisao_nao_aprovada: "Revisão jurídica humana pendente ou não aprovada.",
  atualizacao_pendente: "Nova conferência necessária antes de utilizar a referência.",
  vigencia_nao_conferida: "Vigência desta versão ainda não conferida.",
  situacao_nao_aplicavel: "Situação jurídica ainda não confirmada como vigente.",
  fora_da_vigencia: "Data consultada fora do intervalo cadastrado para esta versão.",
  precedente_nao_aplicavel: "Tese, situação e alcance do precedente ainda não liberados.",
  captura_futura: "Data de captura inconsistente.",
  revisao_futura: "Data de revisão inconsistente.",
};

export function LegalLibraryResults({ data }: { data: LegalLibraryResult }) {
  return (
    <section aria-label="Resultados da biblioteca" className="mt-6">
      <p role="status">
        {data.total} referências encontradas. Data de referência: {data.onDate}.
      </p>
      <p className="mt-2 rounded-xl bg-warning p-4 text-warning-foreground">{data.notice}</p>
      {!data.items.length && <p className="mt-5">Nenhuma referência corresponde aos filtros.</p>}
      <ul className="mt-5 space-y-5">
        {data.items.map((record) => (
          <li
            key={`${record.id}@${record.version}`}
            className="rounded-xl border border-border p-5 break-words"
          >
            <h2 className="text-xl font-bold">{record.title}</h2>
            <p className="mt-2">
              {record.kind === "jurisprudencia" ? "Jurisprudência" : "Legislação"} ·{" "}
              {record.authority}
            </p>
            <p className="mt-2 font-bold">
              {record.assessment.usable
                ? "Referência revisada — não constitui conclusão sobre benefício"
                : "Uso em conclusões bloqueado"}
            </p>
            <p className="mt-2">
              Dispositivos ou identificação para conferência: {record.references.join("; ")}.
            </p>
            <p className="mt-2">
              Início informado: {record.effective.from}. Fim informado:{" "}
              {record.effective.until ?? "não definido"}.{" "}
              {record.effective.verified
                ? "Intervalo conferido para esta versão."
                : "Intervalo ainda não conferido; não comprova vigência histórica do texto consolidado."}
            </p>
            {record.precedent && (
              <p className="mt-2">
                {record.precedent.court} ·{" "}
                {record.precedent.category === "tema" ? "Tema" : "Súmula"} {record.precedent.number}{" "}
                · Processo: {record.precedent.caseNumber ?? "identificação pendente"}. Alcance:{" "}
                {record.precedent.scopeNote ?? "conferência pendente"}.
              </p>
            )}
            <a
              className="mt-3 inline-block text-primary underline"
              href={record.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Consultar fonte oficial: {record.authority}
            </a>
            {!record.assessment.usable && (
              <ul className="mt-3 list-disc pl-5">
                {record.assessment.blockers.map((reason) => (
                  <li key={reason}>
                    {BLOCKERS[reason] ?? "Registro requer conferência antes do uso."}
                  </li>
                ))}
              </ul>
            )}
            <details className="mt-4">
              <summary className="cursor-pointer font-bold">Versão, revisão e histórico</summary>
              <p className="mt-2">
                Versão: {record.version}. Revisão do cadastro: {record.revision}.
              </p>
              <p>
                Revisão jurídica: {record.review.status}. Próxima conferência:{" "}
                {record.review.dueOn ?? "não definida"}.
              </p>
              <p>
                Responsável pela revisão: {record.review.reviewerReference ?? "não registrado"}.
              </p>
              <p>
                Captura: {record.capture?.capturedAt ?? "não realizada"}.{" "}
                {record.capture ? "Captura não equivale a revisão jurídica." : ""}
              </p>
              {record.capture && (
                <p className="break-all">SHA-256 do texto capturado: {record.capture.sha256}</p>
              )}
              <ul className="mt-2 list-disc pl-5">
                {record.history.map((event, index) => (
                  <li key={`${event.at}-${index}`}>
                    {event.at}: {event.reason}
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
