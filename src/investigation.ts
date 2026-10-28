import { randomUUID } from 'node:crypto';
import { DomainError } from './domain.ts';
import type { Analysis, CaseState } from './domain.ts';
import { conflictingFields, missingDocuments, nextQuestion } from './interview.ts';
import { citationFor, verifyCitation, demoKnowledge, KnowledgeBase } from './knowledge.ts';
import { evaluateRule, familyInformationDemoRule } from './rules.ts';

export interface AnalysisProvider { analyze(state: CaseState): Analysis }
// Coordenador determinístico local. Nenhuma API de LLM é chamada nesta fase.
export class DemoInvestigator implements AnalysisProvider {
  knowledge: KnowledgeBase;
  constructor(knowledge = demoKnowledge()) { this.knowledge = knowledge; }
  analyze(state: CaseState): Analysis {
    const sources = this.knowledge.search('BPC renda composição familiar ' + (state.case.denialReason ?? ''), { benefit: state.case.benefit, date: state.case.der, uf: state.case.uf, mode: 'demonstracao' });
    const citations = sources.map(citationFor);
    if (citations.some(c => !verifyCitation(c, sources))) throw new DomainError('Citação sem passagem verificável.');
    const question = nextQuestion(state);
    const conflicts = conflictingFields(state);
    const familyMissing = state.case.benefit === 'bpc' && !state.facts.some(f => f.field === 'composicao_familiar');
    const rules = state.case.benefit === 'bpc' && sources.some(s => s.id === 'demo-bpc') ? [evaluateRule(familyInformationDemoRule, state, sources, 'demonstracao')] : [];
    return {
      id: randomUUID(), case_id: state.case.id, status: 'indeterminado', mode: 'demonstracao', created_at: new Date().toISOString(),
      resumo: state.case.benefit === 'rpps' ? 'RPPS está fora do escopo inicial. Recomenda-se atendimento especializado.' : 'Investigação preliminar demonstrativa. Não é possível concluir sobre direito ao benefício.',
      fatos_comprovados: state.facts.filter(f => f.origin === 'documental' && f.confirmed),
      fatos_declarados: state.facts.filter(f => f.origin === 'declarado'),
      motivo_indeferimento: state.case.denialReason,
      hipoteses_favoraveis: familyMissing ? [{ descricao: 'Verificar se as informações familiares consideradas na negativa estão completas. É uma pergunta de investigação, sem tese jurídica validada.', evidencias: [], provas_necessarias: ['composição familiar documentada', 'comprovantes dos rendimentos pertinentes'] }] : [],
      fundamentos_contrarios: ['Não há regras jurídicas aprovadas neste núcleo.', ...conflicts.map(field => 'Informações divergentes: ' + field)],
      regras_executadas: rules, fontes: citations, documentos_faltantes: missingDocuments(state),
      prazos_a_verificar: [state.case.noticeDate ? 'Data de ciência informada, ainda sem validação documental e regra de prazo aprovada. Não foi calculada data fatal.' : 'Confirmar a data de ciência da negativa; nenhum prazo fatal foi calculado.'],
      proximos_passos: state.case.benefit === 'rpps' ? ['Buscar orientação especializada em RPPS.'] : [question?.text ?? 'Submeter documentos e regras à revisão especializada.', 'Conferir a legislação aplicável à DER antes de qualquer conclusão.'],
      limitacoes: ['Uso exclusivo de dados fictícios; fontes e regras demonstrativas não têm valor jurídico.', 'PDF/OCR reais, LLM, pesquisa oficial e cálculos de elegibilidade ainda não integrados.', 'Fatos extraídos aguardam confirmação explícita; confirmação não substitui perícia documental.', ...state.facts.filter(f => f.origin === 'documental' && !f.confirmed).map(f => 'Fato aguardando confirmação: ' + f.id)],
      revisao_profissional_recomendada: true,
      audit: { sourceVersions: sources.map(s => s.id + '@' + s.version), engineVersion: '0.1.0', model: 'mock-local-v1', promptVersion: 'demo-v1', caseRevision: state.case.revision }
    };
  }
}
