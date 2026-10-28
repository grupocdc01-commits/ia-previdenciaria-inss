# IA Previdenciária — pacote de início para Codex

**Projeto independente do Bonaprev.** Nome comercial provisório: Meu Direito INSS (não verificar como marca registrada sem pesquisa). Versão de especificação: 2026-10-27.

## Objetivo
Construir um agente de triagem e investigação de indeferimentos de benefícios do INSS, acessível pelo celular, que entrevista o segurado, interpreta documentos, pesquisa fontes oficiais e identifica hipóteses juridicamente sustentáveis de revisão administrativa ou discussão judicial. Nunca prometer concessão nem se apresentar como advogado.

## Ordem de execução
1. Leia `docs/PRD.md`, `docs/ARQUITETURA.md`, `agent/AGENTS.md`, `docs/FONTES_E_INGESTAO.md`, `docs/MOTOR_REGRAS.md`, `docs/SEGURANCA.md` e `tests/CASOS_TESTE.md`.
2. Faça inventário do repositório atual; se estiver vazio, crie um monorepo TypeScript com testes e configuração de ambiente. Não destrua arquivos existentes.
3. Implemente **primeiro** o núcleo em modo local com dados sintéticos, interfaces tipadas, logs e testes. Nada de scraping indiscriminado ou consultas a sistemas autenticados.
4. Não invente credenciais, dados jurídicos, conectores ou resultados de consulta. Dependências externas devem usar adaptadores e mocks até configuração explícita.
5. Apresente plano, riscos, mudanças, comandos de teste e resultados. Faça commits pequenos e rastreáveis.

## Entrega inicial obrigatória
API de casos, ingestão de documentos de teste, extração de texto, classificadores, pipeline RAG com fontes de exemplo identificadas como DEMONSTRAÇÃO, avaliador de regras com resultados `atendido|nao_atendido|indeterminado`, perguntas investigativas e gerador de relatório preliminar. Não usar regras fictícias para pareceres reais.

## Comando de início sugerido
"Leia integralmente os documentos deste pacote, apresente plano técnico e implemente a Etapa 1 (núcleo local com testes). Não implemente pagamentos nem publique o sistema. Não gere conclusões jurídicas sem fontes verificadas."
