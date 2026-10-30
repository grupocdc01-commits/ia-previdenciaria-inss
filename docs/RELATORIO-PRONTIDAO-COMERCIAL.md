# Relatório de prontidão comercial — IA Previdenciária INSS
Data: 30/10/2026. **Conclusão: o sistema NÃO está pronto para comercialização.** Pode ser usado como protótipo/piloto fechado com dados fictícios ou com consentimento explícito e sem cobrança.

## 1. Funcionalidades
| Área | Estado | Observação |
|---|---|---|
| Página inicial, questionário, exemplos | Operacional | Questionário guarda dados só em memória (perde ao recarregar). |
| Investigação contextual no questionário | Operacional (parcial) | 5 gatilhos; respostas ainda não alimentam o motor nem o relatório na tela. |
| Contas (e-mail, Google, Lovable) | Operacional | Teste com duas contas para isolamento ainda não feito. |
| Conversa privada com histórico | Operacional | Gemini 3.1 Flash Lite gratuito; testado só por chamada direta, não pela conversa completa. |
| Áudio com transcrição | Parcial | Transcrição real usa o gateway; não testada com voz real. |
| Envio privado de documentos | Operacional | 10 MB, assinatura binária, link 60 s, duplicidade. |
| Leitura de documentos por IA | Parcial | Implementada, nunca executada com documento real. |
| Motor jurídico determinístico | Parcial | 5 módulos + encaminhamento; não aparece no site; fontes não verificadas. |
| Relatório técnico/simples | Parcial | Funções existem; não há tela final nem PDF. |
| Pagamento R$9,99 | Ausente | Pagamentos não habilitados. |
| PDF do dossiê | Ausente | |
| Painel administrativo, suporte, métricas | Ausente | Só painel de uso/privacidade do próprio usuário. |
| Exclusão agendada | Parcial | Rotina criada e pausada; prazo não definido. |

## 2. Segurança / LGPD
- RLS por proprietário em todas as tabelas novas; bucket privado; links temporários; chaves só no servidor.
- Consentimento do responsável e do cidadão exigidos antes de enviar dados ao Gemini.
- Lacunas: sem teste de duas contas; sem política de privacidade/termos jurídicos revisados; sem DPO/canal do titular; sem registro de incidentes; termos do Google (nível gratuito pode usar dados para melhoria do produto) **não compatíveis com dados sensíveis** sem análise jurídica — risco P0.

## 3. Precisão jurídica
- Todas as fontes (leis, decreto, EC 103, LOAS, IN 128, STF Tema 350, STJ Súmula 149 e Tema 554) com status "não verificada" e "revisão pendente".
- Artigos citados de memória, sem conferência com texto oficial; sem processo de atualização de normas nem monitoramento de jurisprudência.
- Faltam: regras de transição, pensão, maternidade, especial, rural completa, salário mínimo oficial.

## 4. UX, acessibilidade, mobile
- Fonte legível, botões grandes, mobile 390 px sem rolagem lateral.
- Falta: auditoria WCAG com leitor de tela, teste com idosos reais, câmera dedicada, retomar questionário após recarregar.

## 5. Custos e escala
- Gemini gratuito: limite global 400/dia (3.1) e 15/dia (2.5) + 20/dia por conta. Acima disso o serviço para — inviável para escala comercial sem plano pago.
- Sem cache, filas ou monitoramento de custos agregados.

## 6. Testes
- 58 testes automatizados (unidade e componentes) passam; typecheck limpo.
- Ausentes: testes ponta a ponta autenticados, carga, segurança/pentest, regressão visual.

## 7. Riscos de comercializar hoje
Exercício irregular da advocacia / publicidade jurídica (OAB), orientação errada por fonte não validada, vazamento de dados sensíveis, cobrança sem resultado entregável, dependência de cota gratuita.

## 8. Prioridades
- **P0:** revisão por advogado de todas as fontes/artigos e precedentes; termos de uso e privacidade revisados; decisão sobre Gemini gratuito x pago para dados pessoais; teste de isolamento entre contas; pagamento real com confirmação no servidor.
- **P1:** mostrar motor + investigação contextual no painel; PDF; persistir questionário; prazo de retenção; testes ponta a ponta; suporte e canal LGPD.
- **P2:** painel administrativo, métricas, câmera, novos módulos, monitoramento de normas.

## 9. Critérios objetivos de lançamento
1. 100% das fontes usadas com hash verificado e revisor registrado.
2. Parecer jurídico sobre o modelo de negócio (OAB/LGPD).
3. Teste de duas contas sem vazamento; varredura de segurança sem achados críticos.
4. Pagamento confirmado por webhook real liberando resultado e PDF.
5. Testes ponta a ponta do fluxo completo passando; teste com ao menos 5 usuários reais do público-alvo.
6. Prazo de retenção definido e rotina de exclusão ativa.
7. Provedor de IA com termos adequados a dados pessoais.