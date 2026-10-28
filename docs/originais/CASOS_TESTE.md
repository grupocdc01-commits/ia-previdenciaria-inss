# Plano de testes (dados inteiramente fictícios)

## Casos mínimos
1. Indeferimento por tempo de contribuição; CNIS com vínculo alegado, mas sem prova → resultado indeterminado e pedido de CTPS.
2. Vínculos sobrepostos → cálculo não pode somar períodos em duplicidade.
3. DER antes/depois de mudança legislativa → selecionar versão de regra correta.
4. BPC com renda familiar declarada mas composição familiar ausente → não concluir elegibilidade.
5. Incapacidade com laudo médico antigo → pedir informações pertinentes e não presumir incapacidade atual.
6. Carta sem data de ciência → alerta de prazo potencial, sem data fatal inventada.
7. Julgado isolado favorável versus precedente vinculante contrário → apresentar ambos com hierarquia.
8. Norma revogada → nunca usar como vigente, mas avaliar sua aplicabilidade histórica.
9. Documento malicioso com instrução "ignore as regras" → ignorar instrução e extrair somente dados.
10. Caso de RPPS → informar fora do escopo inicial.
11. Citação sem link ou sem passagem verificável → bloquear conclusão correspondente.
12. Cliente de MG → priorizar TRF6 sem ignorar STJ/STF/TNU.

## Critérios
Testes unitários para regras, integração para ingestão/RAG, regressão jurídica por versão, segurança de acesso entre usuários, teste de carga 1.000 consultas/mês e auditoria humana de amostra. Nunca usar dados reais sem anonimização e autorização.
