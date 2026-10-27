# PRD — Agente de Investigação Previdenciária

## Visão
Ferramenta popular para pessoas com benefício INSS indeferido. Não é ERP de escritórios; Bonaprev é produto separado. Cliente conversa com IA, envia carta de indeferimento e documentos complementares e recebe investigação preliminar fundamentada e relatório em PDF.

## Modelo de negócio
Preço alvo: R$ 9,99 por análise de um indeferimento; perguntas de esclarecimento dentro de uma sessão com limites transparentes a definir. Estimativa de planejamento: 1.000 consultas/mês, receita bruta R$ 9.990, reserva operacional R$ 2.400/mês **não validada**. Custos variam com OCR, tamanho do CNIS, tokens, meios de pagamento, infraestrutura, atendimento, impostos e publicidade. Medir custo real por caso e bloquear abuso.

## Usuário e jornada
1. Página clara: o que faz, limites e preço; não prometer benefício.
2. Triagem gratuita: tipo de benefício, motivo informado, data da ciência da decisão, UF, documentos disponíveis, urgência de prazo; explicar uso dos dados.
3. Consentimento e autorização adequados; upload seguro da carta e CNIS (quando necessário), opcionalmente documentos de prova.
4. IA faz perguntas adicionais individualizadas e distingue fato declarado, documento comprovado e inferência.
5. Cobrança antes de liberar investigação completa (fluxo exato validado por produto/jurídico).
6. Investiga normas aplicáveis na data do fato/DER, decisões e provas; calcula somente com funções testadas.
7. Resultado estruturado: motivo, possíveis inconsistências, fundamentos citados, teses contrárias, provas faltantes, prazos a verificar, próximos passos, incerteza e recomendação de avaliação profissional.
8. PDF legível e área do usuário para acesso limitado por prazo de retenção.

## Cobertura por fases
MVP: aposentadorias RGPS, benefícios por incapacidade e BPC/LOAS, com subtipos ativados apenas após revisão de regras. Fase 2: pensão por morte, salário-maternidade e outros. Regimes próprios de servidores (RPPS) fora do MVP, encaminhar adequadamente.

## Critérios de aceite
- Nenhuma conclusão sem evidência e referência normativa versionada.
- Não converter mera ausência de prova em afirmação de inexistência de direito.
- Nunca inferir automaticamente prazo fatal sem data de ciência confirmada e regra aplicável.
- Estado do cliente prioriza TRF competente, mas não substitui fontes nacionais.
- Exibir caminhos favoráveis e contrários; distinguir precedente vinculante, persuasivo e decisão isolada.
- Quando documentos insuficientes, emitir `indeterminado` e solicitar complementação.
- Operação administrativa para revisar, aprovar e desativar fontes e regras.
- Interface mobile-first, linguagem popular, acessibilidade e relatórios compreensíveis.

## Métricas
Conversão triagem→pagamento, custo total/consulta, tokens/consulta, OCR/página, taxa de casos indeterminados, erros de citação, taxa de encaminhamento humano, incidentes de segurança, precisão contra gabaritos revisados.
