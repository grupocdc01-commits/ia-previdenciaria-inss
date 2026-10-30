# Módulo 2 — Anamnese e investigação contextual

Data: 30/10/2026. Branch exclusiva: `codex/previdenciario-4-modulos`. Base anterior: `a542ca7f6b17484e6f024112af36d037eb2787c2`.

## Entrega e estado de habilitação

**Implementação técnica concluída e testada em ambiente isolado.** As melhorias do questionário de demonstração estão no código. A anamnese privada nova é optativa, depende da migração `0005_atomic_anamnesis_turns.sql` e permanece desabilitada por padrão, pela ausência de `ANAMNESIS_V2_ENABLED=true`.

Nenhuma migração ou configuração foi aplicada ao ambiente real. As conversas privadas existentes continuam na versão 1; não foram convertidas automaticamente. O Módulo 1 permanece sem homologação jurídica e o Módulo 3 não foi iniciado.

## Formulário de demonstração

- Os complementos rurais, de exposição ocupacional e de trabalho sem registro são percorridos individualmente. A resposta ao primeiro já não suprime os outros complementos da mesma etapa.
- Cada resposta tem estado explícito: `confirmado`, `nao_sei` ou `pulado`. “Confirmado” significa escolha confirmada pelo declarante, nunca comprovação documental.
- Opções desconhecidas, repetidas, incompatíveis e confirmações vazias são rejeitadas. “Nenhum destes” é exclusivo. O código usa o catálogo de perguntas, não um objeto de opções fornecido pelo chamador.
- Mudanças na declaração principal removem complementos incompatíveis. O cidadão pode rever os complementos. Ao mudar a pessoa atendida, as respostas do questionário de demonstração são reiniciadas, com aviso visível antes da escolha.
- Perguntas adaptadas passam a registrar desconhecimento e omissão separadamente, sem salvar valores como se fossem fatos. Respostas que deixaram de corresponder às perguntas são invalidadas.
- O avanço e a revisão em memória mantêm a etapa ao desmontar/remontar a tela dentro do mesmo provedor. **Recarregar/fechar a página continua apagando o questionário demonstrativo.** Nada foi acrescentado a localStorage, sessionStorage ou armazenamento de anexos.
- O balão recebe foco acessível, não aceita clique duplo durante a gravação e preserva a seleção após erro para permitir nova tentativa. Controles da etapa ficam desabilitados durante o complemento.
- A conferência mostra complementos, estados das respostas e referências ainda pendentes, mantendo declarações separadas de provas. Uma resposta rural desconhecida/pulada não gera uma avaliação de ausência de indícios.
- A idade informada é validada entre zero e 120 anos como limite técnico de entrada; isso não representa critério de benefício. Datas de ciência não podem ser inválidas ou futuras. Nenhum prazo é calculado.

## Anamnese privada estruturada — versão 2

O fluxo novo conserva o relato inicial até o cidadão confirmar que terminou. Não deduz benefício, trabalho rural, incapacidade ou outras informações a partir de palavras presentes na história.

Após a conclusão explícita, a pessoa seleciona o benefício e responde uma pergunta por vez. As perguntas abrangem situação do pedido, comunicação, datas, idade, tipo de aposentadoria quando pertinente, tipos de trabalho, histórico declarado, documentos opcionais, recurso e esclarecimentos. Para BPC há perguntas sobre apoio cotidiano e composição domiciliar, sem cálculo de renda. Idade desconhecida não é classificada como idade infantil.

Somente escolhas explícitas acionam os complementos. Trabalho rural organiza autodeclaração, CCIR/ITR/INCRA, notas, contratos, sindicato/cooperativa e testemunhas; exposição ocupacional organiza PPP/LTCAT/CTPS; também há complementos de trabalho informal, limitações para trabalhar e categoria da negativa. Nenhum documento ou testemunha é avaliado como prova suficiente.

O cidadão pode escolher Não sei ou Pular, revisar declarações e alterar o benefício. Alterar o benefício reinicia respostas dependentes, preservando o relato. Alterar a situação invalida motivo/datas dependentes; alterar a idade invalida o apoio cotidiano; alterar tipos de trabalho remove os complementos que deixaram de ser pertinentes. O histórico de mensagens enviado anteriormente é preservado no banco.

Datas declaradas divergentes são apresentadas para conferência, sem correção automática. A coleta pode terminar com lacunas: documentos não são obrigatórios e `canConclude` permanece sempre falso.

Áudio usa o componente existente: a transcrição vai para o rascunho e precisa ser revisada e enviada explicitamente. O avanço é bloqueado durante a gravação. A versão 2 não chama Gemini nem outro gerador de texto; perguntas e transições são determinísticas. Isso não habilita qualquer serviço pago.

O painel continua disponível para consultar respostas enviadas e documentos. A versão 2 persiste apenas na infraestrutura privada existente, por `CloudCaseAdapter`; não usa o armazenamento do navegador nem uma biblioteca compartilhada.

## Persistência transacional e concorrência

A rota `POST /api/anamnese` exige a opção de habilitação e uma sessão autenticada. O corpo é lido com limite real de 64 KiB, independentemente de Content-Length, e validado por schema estrito. Textos têm limite de 4.000 caracteres; relato de até 100 trechos; alternativas são validadas contra opções conhecidas. Dados persistidos inválidos não são substituídos silenciosamente por respostas vazias ou por relato concluído.

Uma investigação nova da versão 2 sem `storyStatus` fica em coleta, ao contrário dos registros legados da versão 1, cujo padrão histórico de relato concluído é preservado. Uma versão 2 que afirma ter concluído um relato vazio é rejeitada.

Cada tentativa envia identificador próprio, versão temporal esperada e ação explícita. Repetir o mesmo envio reaproveita o identificador; uma falha de rede não limpa o rascunho. O servidor compara um hash do pedido normalizado. Esse hash serve somente para idempotência, não como prova do conteúdo do relato.

A função SQL `commit_anamnesis_turn`:

1. Exige `auth.uid()` e bloqueia a linha da investigação pertencente ao cidadão.
2. Reconhece repetição idêntica sem gravar novamente; rejeita reuso do identificador com outro conteúdo.
3. Confere `updated_at` para rejeitar respostas concorrentes desatualizadas.
4. Insere as mensagens do usuário e da assistente, atualiza fatos e registra a tentativa **na mesma transação**. As mensagens recebem instantes distintos e monotônicos para manter a ordem do histórico.
5. Mantém histórico privado e impede escrita direta do usuário na tabela de controle de tentativas.

A função tem privilégio definido e busca restrita de schemas, confere o proprietário explicitamente e não concede execução a anônimos. A tabela `anamnesis_turns` tem RLS para leitura pelo proprietário. A API mapeia falhas para respostas controladas, sem devolver mensagens internas do banco. Falta de migração é tratada como indisponibilidade, não como sucesso.

A migração é escrita à mão e registrada no journal. Os tipos TypeScript foram atualizados para o novo contrato. Não foi gerado um snapshot fictício a partir de `drizzle/schema.ts`, que permanece intencionalmente vazio na origem. A aplicação pelo migrador real e por PostgREST ainda deve ser validada em homologação.

## Testes executados

| Verificação                 |       Aprovados |     Reprovados | Escopo                                                                     |
| --------------------------- | --------------: | -------------: | -------------------------------------------------------------------------- |
| Suíte da aplicação          |             224 |              0 | 22 arquivos, nenhum teste pulado                                           |
| Python preexistente         |               7 |              0 | Captura oficial simulada, sem rede                                         |
| PostgreSQL local            |              10 |              0 | Todas as seis migrações, transações, privilégios e RLS                     |
| Simples do Módulo 2         |               5 |              0 | Relato, complementos, estados e retomada                                   |
| Médio do Módulo 2           |              25 |              0 | Entradas inválidas, mudanças de declaração, erros e preservação de dados   |
| Alto estresse do domínio    |               2 |              0 | 200 sessões isoladas e 5.000 opções inválidas repetidas                    |
| Repetição paralela da suíte | 1.344 execuções |              0 | Seis rodadas de 224; três processos simultâneos, dois workers por processo |
| TypeScript                  |         saída 0 |        0 erros | `tsc --noEmit`                                                             |
| Lint                        |         saída 0 |        0 erros | 16 avisos Fast Refresh preexistentes                                       |
| Build                       |         saída 0 | 0 erros fatais | Build local, sem implantação                                               |

São **241 testes distintos** somando aplicação, Python e SQL. Os testes por nível são subconjuntos dos 224 e as 1.344 execuções são repetições, não novos casos distintos. Execuções filtradas excluem deliberadamente os demais níveis; a suíte completa os executou todos.

A rodada paralela foi seguida de uma checagem focal de navegação da interface e de nova execução completa de testes, TypeScript, lint e build. Uma parametrização incorreta de um teste novo de seleção de alternativas foi identificada pelo TypeScript e corrigida antes da rodada final.

Além dos testes de domínio, há cobertura de balão, foco, exclusividade de alternativas, erros de envio, rascunho/transcrição, clique duplo, bloqueio durante gravação, retomada em memória, troca da pessoa e contrato da API com autenticação simulada. `fetch` permanece bloqueado por padrão nos testes.

### Banco real, mas somente local e descartável

Foi usado PostgreSQL 16 em contêiner Docker local, sem rede e sem portas publicadas, com imagem fixada pelo digest `sha256:0cefaabd882e42bcb2a2f3dc56d3ce4770560ba62fd7f197f1a2e008fd5731ab`. O teste cria e remove seu próprio banco de nome aleatório. Foram usados esquemas mínimos de auth/storage e duas identidades fictícias, não contas reais nem tokens de produção.

Os dez testes validaram commit normal, repetição, identificador reutilizado com outro conteúdo, versão desatualizada, isolamento entre identidades, bloqueio de anônimo, proibição de escrita direta, rollback após falha de mensagem, vinte repetições simultâneas do mesmo pedido e vinte respostas concorrentes distintas, com até oito conexões de teste.

Nas vinte repetições houve um commit e dezenove reconhecimentos de duplicidade. Nas vinte respostas concorrentes houve um commit e dezenove rejeições esperadas de versão desatualizada. Essas rejeições são o comportamento testado, não falhas de teste.

As 200 sessões via Promise.all usam uma única VM JavaScript, não representam 200 usuários reais. O paralelismo efetivo foi exercitado pelos processos Vitest e pelas conexões PostgreSQL separadas. Não foi medido throughput em produção, autenticação Supabase real, microfone real ou serviços externos.

O contêiner e seu volume foram removidos após os testes. Nenhum banco real de clientes foi consultado ou alterado.

## Reprodução

```sh
npm test
python -m unittest discover -s scripts -p 'test_*.py'
./node_modules/.bin/tsc --noEmit
npm run lint
npm run build
./node_modules/.bin/vitest run src/test/anamnesis.test.ts -t 'Módulo 2 — simples'
./node_modules/.bin/vitest run src/test/anamnesis.test.ts -t 'Módulo 2 — médio'
./node_modules/.bin/vitest run src/test/anamnesis.test.ts -t 'Módulo 2 — alto estresse local'
```

O teste de banco não aceita URL de conexão: exige `ANAMNESIS_TEST_CONTAINER` com nome `inss-module2-*`, em Docker local, imagem PostgreSQL fixada por digest, rede `none` e nenhuma porta publicada. Ele se recusa a executar fora dessas condições. Exemplo para um contêiner descartável criado especificamente para esse fim:

```sh
ANAMNESIS_TEST_CONTAINER=inss-module2-check python scripts/check_anamnesis_database.py
```

Para repetir a estabilidade da suíte, executar seis vezes `./node_modules/.bin/vitest run --maxWorkers=2`, mantendo até três processos simultâneos e conferindo cada código de saída. Evidências, tempos e hashes dos logs: `docs/evidencias-modulo-2.json`.

## Habilitação futura e pendências

1. Revisar e aplicar a migração 0005 em ambiente de homologação autorizado, usando o migrador real; confirmar contratos de PostgREST e permissões do papel authenticated.
2. Testar login e retomada no navegador com duas contas fictícias reais do ambiente de testes, verificando isolamento de mensagens, respostas, cache e anexos. Os testes de RLS locais não substituem essa validação.
3. Somente depois habilitar `ANAMNESIS_V2_ENABLED=true` nesse ambiente de testes. A opção afeta a criação de investigações novas; as antigas permanecem na versão 1. Não há conversão automática dos históricos antigos.
4. Validar áudio real, acessibilidade com leitor de tela e navegação ponta a ponta. Nesta etapa foram usados mocks de gravação/transcrição e testes de componente.
5. Definir eventual política de migração voluntária de conversas antigas. O questionário de demonstração continua somente em memória e não é enviado automaticamente ao backend privado.
6. Manter a homologação do Módulo 1 pendente e seus bloqueios ativos. As respostas não alimentam cálculos, não confirmam provas e não liberam relatório jurídico, prazo, cobrança ou PDF.

Não houve publicação, ativação de serviço pago, aplicação de migração no ambiente real ou alteração da branch main. O Módulo 3 aguarda autorização.

## Arquivos desta entrega

- `README.md`
- `docs/MODULO-2-ANAMNESE.md`
- `docs/evidencias-modulo-2-resultados.txt`
- `docs/evidencias-modulo-2.json`
- `drizzle/migrations/0005_atomic_anamnesis_turns.sql`
- `drizzle/migrations/meta/_journal.json`
- `scripts/check_anamnesis_database.py`
- `src/components/context-probe.tsx`
- `src/components/contextual-summary.tsx`
- `src/components/investigation-chat.tsx`
- `src/components/structured-interview.tsx`
- `src/integrations/supabase/types.ts`
- `src/lib/anamnesis-schema.ts`
- `src/lib/anamnesis.ts`
- `src/lib/api/anamnesis.server.ts`
- `src/lib/api/cloud-adapter.ts`
- `src/lib/api/investigation.functions.ts`
- `src/lib/case-model.ts`
- `src/lib/case-store.tsx`
- `src/lib/investigation.ts`
- `src/lib/legal/contextual.ts`
- `src/routeTree.gen.ts`
- `src/routes/_authenticated/investigacao.$threadId.painel.tsx`
- `src/routes/api/anamnese.ts`
- `src/routes/api/investigation-chat.ts`
- `src/routes/conferencia.tsx`
- `src/routes/perguntas.tsx`
- `src/routes/questionario.tsx`
- `src/test/anamnesis-api.test.ts`
- `src/test/anamnesis.test.ts`
- `src/test/context-probe-ui.test.tsx`
- `src/test/contextual-probe.test.ts`
- `src/test/questionnaire-context.test.tsx`
- `src/test/structured-interview-ui.test.tsx`
