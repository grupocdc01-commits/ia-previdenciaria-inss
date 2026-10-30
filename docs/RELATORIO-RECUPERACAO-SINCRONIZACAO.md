# Recuperação e sincronização — IA Previdenciária INSS

Data: 30/10/2026.

## Resultado

Código original recuperado na branch `codex/previdenciario-4-modulos`, a partir do commit remoto `2f4a9ec2680e5dae78d952029326d90b7f1d874c`. Nenhuma correção funcional foi feita e os quatro módulos não foram iniciados.

A branch `main` permaneceu no commit `a445b20e7be9f4e2b1f1b68d72033a596530423a`.

## Origem e integridade

- ZIP recebido: `codigo-completo (1).zip`, 140 arquivos, sem .env. Verificação CRC sem erros, sem caminhos inseguros ou links simbólicos.
- SHA-256 do ZIP: `8d27d8ffb12c2116320abc0feaca2d05cd2b2326e9481af237601598047a3df3`.
- O ZIP é uma versão anterior: duas migrações e quatro arquivos de teste.
- Origem dos arquivos textuais atualizados: projeto Lovable `49a79647-4b86-4341-b43f-e8289c9cfe68`, commit fixo `ca3455e2c0ac70930e213afd7356f3810c6bf237`.
- Importados 173 arquivos textuais dessa versão e os dois binários originais do ZIP (`public/favicon.ico` e `src/assets/assistente-exemplos.jpg`). Os binários não puderam ser comparados byte a byte com o commit Lovable, pois o conector os entrega como texto com perda de bytes.
- Total recuperado: 175 arquivos; o plano de quatro módulos já existente na branch foi preservado. Na importação, 165 arquivos foram adicionados e dez atualizados a partir das fontes. Entre os dez, nove diferem apenas por quebra de linha final; o README foi recuperado integralmente.
- Conferência SHA-256 após instalação, testes e build: nenhum dos 175 arquivos importados foi alterado pelas ferramentas.
- A árvore Lovable tem 176 arquivos; o .env foi excluído sem ser lido. A varredura de padrões comuns de credenciais não encontrou correspondências nos arquivos importados; isso não substitui uma auditoria especializada.
- Não foram copiados dados de produção, sessões, tokens ou senhas.

## Ambiente e sincronização

O Git e o registro npm tornaram-se acessíveis ao executar os comandos com a permissão de rede do ambiente. O fetch da branch autorizada foi concluído. Não foi necessário publicar o aplicativo.

Antes do fetch funcionar, os objetos originais da branch foram recuperados pelo conector do GitHub e validados pelos seus hashes Git, incluindo os dois commits acima da main. O Git fsck passou. Não houve criação de conteúdo substituto nem reescrita de histórico.

## Validação executada

| Verificação | Resultado |
|---|---|
| Instalação | Bun 1.4.4; `bun install --frozen-lockfile --ignore-scripts`; 830 pacotes instalados, lockfile preservado |
| Testes existentes | `npm test`: 10 arquivos de teste passaram; 57 casos passaram; um arquivo falhou na importação |
| Tipagem | `tsc --noEmit`: aprovado, código de saída 0 |
| Build local | `npm run build`: aprovado, código de saída 0; nenhuma implantação |
| Lint | `npm run lint`: reprovado, 1.425 erros e 16 avisos |

A suíte `src/test/app-routing.test.tsx` falhou antes de executar seu caso porque a importação das rotas instancia o adaptador Cloud, que acessa o cliente Supabase sem configuração. Faltam `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` (ou as equivalentes VITE_). Não foram inseridas credenciais fictícias nem solicitadas credenciais em chat. A suíte completa, portanto, não está aprovada.

Dos erros do lint, 1.424 são de formatação. O outro é `no-control-regex` em `src/routes/api/private-document-upload.ts:36`. Os 16 avisos são de `react-refresh/only-export-components`. Não foi executado --fix.

O build registrou avisos de empacotamento e fallback de WebAssembly do Shiki; conseguiu concluir. Build aprovado não comprova funcionamento de autenticação, banco ou IA.

## Estrutura recuperada

Componentes de interface e investigação, rotas públicas e autenticadas, inicialização, formulário contextual, adaptadores, servidor, integração Supabase, upload, transcrição, auxiliares Gemini, motor jurídico preliminar, catálogo de fontes, relatórios, configuração do projeto, dependências e lockfile.

Banco: cinco migrações SQL e seus metadados foram recuperados. `drizzle/schema.ts` permanece vazio por design na origem; as migrações contêm as definições. Nenhuma migração foi aplicada nem banco criado ou consultado.

Testes: 11 arquivos de teste e setup/configuração recuperados. Não foram criados novos testes.

## Pendências antes dos quatro módulos

1. Resolver o acoplamento da suíte de rotas à configuração Supabase ou definir um ambiente de testes adequado, em etapa própria. Não configurar produção para fazer passar um teste unitário.
2. Revisar os problemas de lint sem aplicar formatação geral durante a recuperação.
3. Validar migrações e isolamento entre contas em ambiente de testes autorizado.
4. Exercitar autenticação, upload, extração, transcrição e conversa ponta a ponta; essas integrações não foram verificadas por chamadas reais.
5. Manter o motor preliminar até revisão jurídica, verificação das fontes e correção dos problemas já identificados no diagnóstico.
6. Conferir a proveniência dos dois binários se for exigida equivalência exata com a versão mais recente do Lovable.
7. A .gitignore original não exclui explicitamente todos os arquivos .env; tratar em etapa de segurança, sem importar credenciais.

Não houve publicação, ativação de serviços pagos, cobrança ou alteração de main. Os resultados anteriores de “58 testes aprovados” não foram reproduzidos nesta configuração: foram 57 casos aprovados e uma suíte bloqueada.

