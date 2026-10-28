# Implementação — Atendimento de aposentadoria negada (MVP)

## Escopo
Atender exclusivamente pessoas cujo pedido de **aposentadoria no RGPS foi indeferido pelo INSS**. Não oferecer BPC, pensão, auxílio por incapacidade ou casos ainda não decididos neste fluxo. Se o caso estiver fora do escopo, explicar e encerrar sem cobrar. Preservar os documentos e mecanismos gerais já existentes para expansão futura.

## Experiência inicial
Título: **Sua aposentadoria foi negada pelo INSS?**
Texto: "Olá! Sou uma assistente virtual de orientação previdenciária. Vou ouvir sua história, ajudar a entender o motivo da negativa e investigar informações que merecem verificação. Você pode conversar por texto ou áudio. Enviar documentos é opcional para começar; sem eles, a análise poderá ser apenas preliminar."
Aviso acessível: "Esta ferramenta usa inteligência artificial, não é o INSS e não substitui a análise individual de advogado habilitado. Não há garantia de concessão."
CTA: "Começar minha investigação".

## Jornada adaptativa
1. Consentimento claro para tratamento de dados, retenção e exclusão, antes de coletar informações pessoais.
2. Confirmar que houve indeferimento de **aposentadoria**; perguntar tipo (idade, regras de transição/tempo, especial, rural, pessoa com deficiência, não sei).
3. Solicitar DER, data de ciência da decisão (se conhecida), UF e motivo comunicado pelo INSS; aceitar "não sei" sem bloquear.
4. Perguntar se já houve recurso, revisão ou processo judicial, com datas quando conhecidas.
5. Perguntar uma coisa por vez; selecionar ramificações:
   - Tempo/carência: CNIS, vínculos ausentes, contribuições, serviço militar, períodos rurais e indicadores de pendência.
   - Idade/regras de transição: data de nascimento, sexo para regra aplicável quando necessário, períodos e marco temporal.
   - Especial: atividades, agentes nocivos, PPP/LTCAT e períodos.
   - Rural: intervalos, categoria e início de prova material.
   - PcD: período e grau alegado, documentação e avaliações, sem inferir enquadramento.
6. Oferecer upload de carta de indeferimento, CNIS, CTPS, PPP, comprovantes e outros arquivos; **botão "Continuar sem documentos" sempre disponível**. Nunca pedir senha gov.br.
7. Confirmar transcrição e fatos extraídos antes da análise.
8. Apresentar resumo editável e painel com: motivo declarado/documentado, fatos confirmados, hipóteses a investigar, fontes verificadas, documentos úteis, incertezas, prazos a confirmar e próximos passos.
9. Cobrança de R$ 9,99 somente após deixar explícito o que será entregue, confirmar preço e obter consentimento; não simular pagamento aprovado.
10. Relatório PDF com referências e data/versão da regra, indicação do que não foi possível verificar.

## Áudio
- Interface com gravar, pausar, cancelar, ouvir antes de enviar, enviar e regravar; indicar duração e tamanho máximo.
- Solicitar permissão de microfone apenas após ação do usuário. Tratar microfone negado e upload alternativo.
- Enviar áudio por conexão autenticada ao backend; validar formato/tamanho, proteger armazenamento e limitar duração/custos.
- Transcrever no servidor; exibir transcrição editável e pedir confirmação antes de usar na investigação.
- Respostas por texto e áudio são intercambiáveis; opcionalmente oferecer leitura em voz alta com controles de reprodução.
- Não exibir microfone funcional se serviço de gravação/transcrição ainda não estiver integrado; sinalizar indisponibilidade.

## Contrato de estado da entrevista
`case_id`, `scope`, `retirement_type`, `denial_reason`, `der`, `decision_notice_date`, `state`, `appeal_status`, `facts_declared[]`, `facts_documented[]`, `missing_evidence[]`, `documents[]`, `messages[]`, `consent_record`, `analysis_status`.
Valores desconhecidos permanecem nulos; não inventar datas ou documentos. Persistência por usuário autenticado, com RLS e trilha de auditoria.

## Critérios de aceite
- O fluxo não pede documentos como condição para começar.
- O motivo "não sei" gera perguntas esclarecedoras, sem inventar o indeferimento.
- Caso não seja aposentadoria indeferida, não segue para pagamento.
- O formulário não pede informações irrelevantes para o subtipo.
- A análise separa fatos relatados, provas documentais, inferências e lacunas.
- Nenhuma regra ou citação é inventada; quando não houver fonte verificada, o resultado é "indeterminado".
- Prazos não são afirmados sem ciência da decisão e regra aplicável confirmadas.
- Áudio tem consentimento, transcrição revisável, falhas tratadas e limites de tamanho.
- Interface mobile-first, acessível e inteiramente em português do Brasil.
- Testes automatizados para ramos de entrevista, documentos ausentes, transcrição, privacidade e escopo.
- Não publicar em produção sem testes, revisão de segurança/LGPD e revisão jurídica.

## Implementação incremental
1. Identificar o código-fonte real do frontend Lovable e confirmar sua branch de sincronização. Se o repositório contiver apenas documentos, **não presumir que o frontend está nele**.
2. Implementar componentes e estado da entrevista, primeiro com testes e dados fictícios claramente identificados.
3. Integrar armazenamento seguro e transcrição de áudio, com credenciais apenas no servidor.
4. Conectar entrevista ao motor jurídico, recuperação de fontes e regras determinísticas testadas.
5. Integrar pagamento, relatório e auditoria.
6. Executar testes, validar acessibilidade e abrir PR para revisão. Nunca mesclar automaticamente.
