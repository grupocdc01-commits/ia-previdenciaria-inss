# Registro de recuperação do núcleo

## Referência preservada

Origem: branch `feat/biblioteca-fontes-oficiais`, commit
`6f99b1817835e22dd706f3b100746fb002ff5354`.

O checkout local começou no commit inicial `a445b20`, branch `work`. Reflog e
objetos locais não continham o núcleo anterior. A leitura remota encontrou os
28 arquivos do snapshot documental. Foram restaurados pelo conector GitHub com
conteúdo base64, preservando bytes; o script de integridade BPC passou.

Depois de habilitar acesso de rede para o comando, foi possível buscar a branch
Git explicitamente e integrá-la ao histórico local. O fetch padrão do checkout
só acompanhava main. A branch de desenvolvimento é
`feat/recuperacao-nucleo-local`.

Os documentos, AGENTS.md, originais e fonte não foram reescritos. Alterações
novas são aditivas, exceto a inclusão de uma seção de execução no README.
`ESTADO_APOS_PUBLICACAO.md` continua como registro histórico, sem alterar o que
ele constatou na instância anterior.

## Código anterior

Os commits `917d5c3` e `99f84cf` não foram encontrados na consulta remota nem nos
objetos locais. A reconstrução atual é nova. Eventual backup futuro deve ser
comparado em branch separada, sem substituir os documentos recuperados.

## Escopo entregue

Núcleo local TypeScript, SQLite, API autenticada por token de desenvolvimento,
evidências rastreáveis, entrevista, busca demonstrativa, motor trivalente,
análise estruturada, PDF e testes. Consulte `NUCLEO_LOCAL.md` para operação e
limitações. Nenhum serviço pago foi contratado e o sistema não foi publicado.

## Revisão proposta

Título: `feat: reconstrói núcleo local de investigação com evidências e testes`

O checkout tinha apenas o README inicial, enquanto o remoto preservava as
especificações e uma fonte draft. A mudança restaura essa base e acrescenta um
fluxo local com dados fictícios, isolamento de casos e relatório rastreável.
Análise jurídica real fica bloqueada. Documentos e coleta são preservados.

Validação: `npm run check`, `npm run build`, `npm run demo` e auditoria de
dependências. O número de testes e os resultados efetivos são registrados na
conclusão da implementação, sem reutilizar resultados da instância anterior.

## Resultados desta entrega

- 31 testes novos aprovados: 24 de núcleo e 7 de API/persistência.
- Verificação TypeScript estrita e compilação aprovadas.
- Demonstração executada com resultado indeterminado e fonte explicitamente fictícia.
- Teste HTTP real em loopback: criação de caso, análise e download de PDF aprovados.
- Texto do PDF extraído com `pdftotext`: aviso, estado e seções conferidos.
- Integridade da fonte BPC aprovada pelo script original.
- Auditoria npm de dependências de produção: zero vulnerabilidades reportadas
  na consulta desta execução, após atualizar Fastify e Zod.
- `git diff --check` sem erros de whitespace.

Esses resultados não atestam precisão jurídica, defesa de LLM real, capacidade
de produção ou desempenho sob carga. Nenhuma dessas validações foi alegada.
