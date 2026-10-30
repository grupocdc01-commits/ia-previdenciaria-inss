# PRD — IA Previdenciária INSS (v2)

Nome público: **IA Previdenciária INSS**. Bonaprev é apenas inspiração de fluxo; nenhum dado, marca ou texto é reutilizado.

## 1. Identidade visual (identidade B)
- Acolhedor e moderno, com aparência de escritório previdenciário.
- Azul profundo (primário), verde-petróleo (ações principais), fundo claro.
- Tipografia Atkinson Hyperlegible, corpo ≥ 17px, alvos de toque ≥ 56px, foco visível.
- Mobile-first; contraste AA; linguagem simples para idosos e público leigo.

## 2. Telas
| Tela | Rota | Estado |
|---|---|---|
| Início "Você pode ter direitos que ainda não conhece" | `/` | Implementado |
| Descobrir meus direitos (triagem, uma pergunta por vez) | `/questionario` → `/perguntas` | Implementado (demonstrativo, em memória) |
| Minha Jornada (atendimentos privados) | `/investigacoes` | Implementado |
| Atendimento: relato por texto/áudio, perguntas guiadas | `/investigacao/$threadId` | Implementado |
| Painel do caso (evidências, fontes, incertezas) | `/investigacao/$threadId/painel` | Implementado, sem conclusão jurídica |
| Privacidade, uso e retenção | `/privacidade` | Implementado |
| Exemplos fictícios | `/exemplos` | Implementado |
| Entrar / redefinir senha | `/auth`, `/reset-password` | Implementado |

## 3. Jornada guiada
1. Ouvir toda a história (texto ou áudio contínuo, com pausar/continuar); só avança após "Terminei de contar".
2. Perguntas adaptativas, uma por vez, com voltar/continuar e progresso.
3. Documentos opcionais, com explicação do motivo de cada um.
4. Painel com o que foi informado, o que não foi verificado e o que não tem fonte validada.
5. Pagamento de R$9,99 apenas após coleta e análise preliminar — **pendente** (pagamentos não habilitados).

## 4. Descoberta de direitos
Triagem preliminar que indica caminhos possíveis (aposentadorias, BPC/LOAS, incapacidade). Nunca afirma direito; o front-end não calcula elegibilidade.

## 5. Benefício negado
Coleta do motivo informado na carta de indeferimento, linha do tempo e documentos. Análise de correção da negativa bloqueada até existirem regras validadas.

## 6. Tempo de contribuição (inspirado no Bonaprev, sem misturar dados)
- Primitiva determinística de união de intervalos no servidor (neutra).
- Módulos de tempo de contribuição, carência e divergências do CNIS: **em desenvolvimento**; exigem requisitos, exceções, vigência, fonte oficial, versão, testes e aprovação humana.

## 7. Captura de documentos
- Upload autenticado para bucket privado, até 10 MB, PDF/PNG/JPEG validados por assinatura binária, sem duplicatas, links de 60 s.
- Câmera: no celular, o seletor de arquivo permite fotografar; captura dedicada é pendente.
- Leitura administrativa via Gemini (gratuito, servidor) apenas com consentimento; dados médicos bloqueados; resultado sempre "a revisar".

## 8. Dossiê
Resumo do caso com origem de cada informação. PDF do dossiê: **pendente** (depende de pagamento e de regras validadas).

## 9. Fontes jurídicas verificáveis
Registro versionado (`legal_rule_versions`) com URL oficial, hash da fonte, vigência e revisor. Candidatas atuais (Lei 8.213/91, LOAS, EC 103/2019) aguardam revisão humana. Texto de IA nunca é resultado jurídico.

## 10. Pendências
- Pagamentos e webhook real; PDF; validação jurídica; prazo de retenção; teste entre duas contas; captura por câmera dedicada.

## Núcleo jurídico (atualização 30/10/2026)
Implementado em `src/lib/legal/` (código puro, testado):
- **Fontes** (`sources.ts`): Lei 8.213/91, Decreto 3.048/99, EC 103/2019, LOAS, IN PRES/INSS 128/2022 com URL, versão, vigência, verificação (hash) e revisão humana. Todas "não verificada / revisão pendente".
- **Motor** (`engine.ts`): BPC idoso, BPC deficiência, incapacidade temporária e permanente, aposentadoria por idade; cada requisito atendido / não atendido / indeterminado com artigo citado. Resultado sempre preliminar; incapacidade nunca atendida só por declaração; salário mínimo nunca inventado.
- **Anamnese adaptativa** (`nextQuestion`): começa por "já pediu ao INSS?" e segue pelo fato faltante mais útil; funciona sem CNIS/CTPS.
- **Períodos** (`periods.ts`): declarados vs comprovados, união sem dupla contagem.
- **Relatórios** (`report.ts`): técnico (fontes com URL/versão/estado) e linguagem simples com pendências.

Ainda falta: conectar o motor à conversa e ao painel (rodar no servidor); transformar extração revisada de documentos em períodos "comprovados"; regras de transição (pontos/pedágio), pensão, salário-maternidade, especial, rural; conferência de hash das fontes; revisão jurídica humana; valor oficial do salário mínimo vindo do backend; PDF.

### Encaminhamento do caso (`src/lib/legal/routing.ts`)
Classifica em via administrativa (requerimento, exigência, acerto CNIS, revisão, recurso CRPS), potencial via judicial (só com controvérsia de fato relatada; menciona JEF sem advogado em 1º grau, Tema 350 do STF, prescrição/decadência; nunca diz que ação é obrigatória ou procedente) e investigação complementar. Cada recomendação traz fonte, fatos usados, lacunas e aviso de revisão humana. Relatório separa "O que posso fazer no INSS" e "Quando procurar assistência jurídica", com documentos e próximos passos. Status sempre "preliminar" enquanto fontes não forem verificadas e revisadas. Pendente: conferir artigos citados no texto oficial, ligar à interface.

## Investigação contextual (out/2026)
- Botão flutuante "Assistente" removido; perguntas complementares aparecem dentro do questionário (`src/lib/legal/contextual.ts`).
- Gatilhos: trabalho rural, insalubre, sem registro, incapacidade, indeferimento. Máximo 1 por etapa, sem repetição, opções Confirmar / Não sei / Pular; nada é preenchido automaticamente.
- Rural: checklist de indícios (autodeclaração, CCIR/ITR/INCRA, notas de produtor, contratos, sindicato, testemunhas); avaliação neutra nunca conclusiva; documento da terra isolado = "indício isolado".
- Precedentes STJ Súmula 149 e Tema 554 catalogados como **não verificados**; nenhuma pesquisa em tempo real.
- Pendente: categoria/época/local do trabalho rural; exibir `contextualTechnical` no relatório e painel; levar as respostas ao motor (`Facts`).
