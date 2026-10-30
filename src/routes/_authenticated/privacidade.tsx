import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { InvestigationShell } from "@/components/investigation-shell";
import { Button } from "@/components/ui/button";
import { cloudAdapter } from "@/lib/api/cloud-adapter";

const statusQuery = queryOptions({
  queryKey: ["private-processing-status"],
  queryFn: () => cloudAdapter.processingStatus(),
});
export const Route = createFileRoute("/_authenticated/privacidade")({
  loader: ({ context }) => context.queryClient.ensureQueryData(statusQuery),
  head: () => ({
    meta: [
      { title: "Privacidade e uso — IA Previdenciária INSS" },
      {
        name: "description",
        content: "Preferências privadas de documentos, leitura e uso de inteligência artificial.",
      },
      { property: "og:title", content: "Privacidade e uso — IA Previdenciária INSS" },
      {
        property: "og:description",
        content: "Controle de documentos privados e estado das integrações.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});
function Privacy() {
  const { data } = useSuspenseQuery(statusQuery);
  const client = useQueryClient();
  const [days, setDays] = useState(data.preferences?.retention_days?.toString() ?? "");
  const [approved, setApproved] = useState(data.preferences?.external_processing_approved ?? false);
  const [confirm, setConfirm] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setNotice("");
    try {
      await fn();
      await client.invalidateQueries({ queryKey: statusQuery.queryKey });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <InvestigationShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold">Privacidade, uso e custos</h1>
        <section className="mt-6 border-b border-border pb-5">
          <h2 className="text-xl font-bold">Estado do atendimento</h2>
          <p className="mt-3">
            Gemini: {data.geminiConfigured ? "chave configurada" : "não configurado"}. Privacidade
            do fornecedor:{" "}
            {data.providerPrivacyApproved
              ? "aprovada pelo responsável"
              : "aprovação pendente; envio externo bloqueado"}
            .
          </p>
          <p className="mt-2">{data.legalStatus}</p>
          <p className="mt-2">{data.paymentStatus}</p>
          <p className="mt-2">
            Preço solicitado: R$9,99 por análise, após coleta e análise preliminar. Complementação
            depois da conclusão requer nova compra. Nenhuma cobrança está disponível agora.
          </p>
          <Button
            className="mt-3"
            variant="outline"
            disabled={busy || !data.geminiConfigured}
            onClick={() =>
              run(async () => {
                const models = await cloudAdapter.validateModels();
                setNotice(
                  `Modelo econômico validado: ${models.economic}. Modelo robusto: ${models.robust ?? "indisponível"}; análise robusta permanece bloqueada.`,
                );
              })
            }
          >
            Validar modelos Gemini
          </Button>
        </section>
        <section className="mt-6 border-b border-border pb-5">
          <h2 className="text-xl font-bold">Seus novos documentos</h2>
          <p className="mt-3">
            Arquivos e leituras são privados, separados por atendimento. Não usamos dados de
            clientes para treinamento. A leitura externa só será habilitada após revisão dos termos
            do Gemini pago e sua autorização. Serviços externos podem manter dados conforme seus
            próprios termos; não prometemos retenção zero.
          </p>
          <label className="flex gap-2 items-start mt-4">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />
            Autorizo leitura de documentos administrativos pelo Gemini quando o responsável
            habilitar o serviço. Não autorizo dados médicos nesta etapa.
          </label>
          <label className="grid gap-2 mt-4">
            Excluir novos documentos após quantos dias do envio?
            <input
              type="number"
              min="1"
              max="3650"
              className="border border-input rounded-md p-2 bg-background"
              value={days}
              onChange={(e) => {
                setDays(e.target.value);
                setConfirm(false);
              }}
            />
          </label>
          <p className="text-sm mt-2">
            Sem prazo preenchido: exclusão automática não definida. Essa preferência não apaga
            conversas, perfil nem anexos antigos.
          </p>
          <label className="flex gap-2 items-start mt-3">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            Confirmo exclusão permanente dos novos documentos e suas leituras após o prazo
            escolhido, inclusive arquivos existentes que já ultrapassaram esse prazo.
          </label>
          <Button
            className="mt-4"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await cloudAdapter.savePreferences({
                  data: {
                    retentionDays: days === "" ? null : Number(days),
                    approved,
                    confirmDeletion: confirm,
                  },
                });
                setNotice(
                  "Preferências salvas. A rotina diária remove documentos vencidos; horários não são exatos.",
                );
              })
            }
          >
            Salvar preferências
          </Button>
        </section>
        <section className="mt-6">
          <h2 className="text-xl font-bold">Uso registrado</h2>
          <p className="mt-2">
            {data.priceStatus} Limite preventivo: 20 chamadas em 24 horas por conta; máximo de 10 MB
            por documento. Tentativas também contam.
          </p>
          {!data.usage.length ? (
            <p className="mt-3">Nenhuma chamada Gemini registrada.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {data.usage.map((event, i) => (
                <li key={i} className="py-3 break-words">
                  {event.operation} · {event.status} · {event.model ?? "modelo não definido"}
                  <p className="text-sm">{new Date(event.created_at).toLocaleString("pt-BR")}</p>
                  <pre className="whitespace-pre-wrap text-sm">
                    {JSON.stringify(event.usage ?? {})}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </section>
        {notice && (
          <p role="status" className="mt-5">
            {notice}
          </p>
        )}
      </div>
    </InvestigationShell>
  );
}
