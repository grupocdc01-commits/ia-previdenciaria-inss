# Integrações e estado operacional

O atendimento anterior e `/exemplos` continuam demonstrativos. As novas investigações têm integração real com Lovable Cloud, separada do adaptador demonstrativo.

## Implementado com integração real
- Contas por e-mail/senha, Google e Lovable; confirmação de e-mail preservada. Recuperação de senha implementada.
- Perfil privado, investigações separadas com URL própria e mensagens persistidas por proprietário; políticas RLS e permissões explícitas.
- Conversa com streaming via Gateway SDK, histórico recuperado no servidor e perguntas de triagem adaptadas ao benefício.
- Gravação no navegador, interrupção, reprodução, cancelamento e transcrição pelo serviço configurado; texto revisável antes de enviar. Nenhuma transcrição simulada.
- Upload privado de fotos/PDFs, abertura por URL temporária, exclusão e opção de continuar sem documentos. Arquivos ainda não são lidos, extraídos ou tratados como prova.
- Painel com declarações individuais e limitações explícitas; nenhum direito, prazo ou fundamento jurídico é calculado/inventado.
- Sete testes passaram; navegação pública, acesso bloqueado sem sessão, cadastro visível e layout de celular/computador verificados sem erros de navegador.

## Verificação ainda bloqueada
- Não há usuários cadastrados para emitir uma sessão de teste. Criar conta, confirmar e-mail e entrar na prévia para verificar duas conversas, restauração do histórico, upload privado, gravação e transcrição ponta a ponta. Código instalado/configuração habilitada não equivale a validação operacional desses fluxos.
- Envio/recebimento de e-mails e os provedores sociais ainda não foram exercitados.
- O lint completo detecta problemas de formatação preexistentes nas telas antigas. O lint dos novos arquivos próprios passou; as telas anteriores não foram reformatadas para preservar o escopo.

## Demonstrativo ou indisponível
- Fluxo anterior: criação de caso, progresso do job, análise e PDF demonstrativos; exemplos isolados preservados.
- Investigação jurídica completa: indisponível até implementação e validação jurídica das regras executáveis.
- Biblioteca: registro de modalidades com estado não validado; não é biblioteca jurídica homologada.
- Leitura documental, jurisprudência verificada e PDF real: ainda indisponíveis.
- `HttpAdapter` anterior continua inativo; não foram chamados endpoints externos com credenciais inventadas.

## Revisão do repositório jurídico
- Branch `feat/aposentadoria-negada-atendimento`, commit consultado `75e3497fa922c7e1a1ffe6f8cea8fa6ae516cd9a`.
- `docs/MOTOR_REGRAS.md`, `docs/IMPLEMENTACAO_APOSENTADORIA_NEGADA.md` e `docs/EXPANSAO_CONHECIMENTO_PREVIDENCIARIO.md` descrevem contratos e funcionalidades planejados. A árvore contém protótipo/documentação, não motor jurídico/backend executável.
- Fonte BPC arquivada está em rascunho, com validade jurídica não verificada. Não foi incorporada como regra aprovada.
- Usuário confirmou o backup `backup/versao-original-2026-10-28`; não houve operações Git de escrita nem publicação.

## Campos sem contrato no backend (não enviar até ajuste)
- paraQuem, situacao, idade, uf, docs iniciais, dataNegativa, comunicacaoExigencia, respostas adaptadas, docStatus.
- Conferir enums de benefício e de status do job contra docs/openapi.json.
- Analysis: estrutura de urgências, fatos declarados/comprovados, preparo para advogado, expiração do PDF.

## Antes de ativar a API jurídica externa
- Definir VITE_API_BASE_URL (nunca localhost).
- Configurar provedor JWT e trocar `adapter` para HttpAdapter.
- Validar contra docs/openapi.json da branch de desenvolvimento.
