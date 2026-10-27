import { createHash, randomUUID } from 'node:crypto';
import { DomainError, documentInput, factInput } from './domain.ts';
import type { CaseState, DocumentRecord, Fact } from './domain.ts';

export interface TextExtractor { extract(text: string): string[] }
// Entrada sintética explícita. PDF/OCR reais exigem adaptadores e validação próprios.
export class SyntheticTextExtractor implements TextExtractor {
  extract(text: string): string[] {
    const pages = text.split('\f');
    if (pages.length > 30) throw new DomainError('Limite de 30 páginas demonstrativas.');
    return pages;
  }
}
export function registerDocument(state: CaseState, input: unknown, extractor: TextExtractor = new SyntheticTextExtractor()): DocumentRecord {
  const data = documentInput.parse(input);
  const sha256 = createHash('sha256').update(data.text).digest('hex');
  const existing = state.documents.find(d => d.sha256 === sha256 && d.kind === data.kind);
  if (existing) return existing;
  if (state.documents.length >= 10) throw new DomainError('Limite de 10 documentos por caso.');
  const document = { ...data, id: randomUUID(), sha256, pages: extractor.extract(data.text), createdAt: new Date().toISOString() };
  state.documents.push(document);
  return document;
}
export function addFact(state: CaseState, input: unknown): Fact {
  const data = factInput.parse(input);
  if (state.facts.length >= 100) throw new DomainError('Limite de fatos atingido.');
  if (data.evidence) {
    const page = state.documents.find(d => d.id === data.evidence!.documentId)?.pages[data.evidence.page - 1];
    if (!page?.includes(data.evidence.quote)) throw new DomainError('Página ou trecho não encontrado no documento deste caso.');
  }
  // Um trecho encontrado comprova proveniência, não a interpretação de seu conteúdo.
  const fact: Fact = { ...data, id: randomUUID(), confirmed: false };
  state.facts.push(fact);
  return fact;
}
export function extractCandidateFacts(state: CaseState, document: DocumentRecord): Fact[] {
  const fields = { 'composição familiar': 'composicao_familiar', 'renda familiar': 'renda_familiar', 'motivo do indeferimento': 'motivo_indeferimento' } as const;
  const results: Fact[] = [];
  for (const [pageIndex, page] of document.pages.entries()) {
    for (const line of page.split(/\r?\n/)) {
      const separator = line.indexOf(':');
      const label = line.slice(0, separator).trim().toLocaleLowerCase('pt-BR');
      const field = fields[label as keyof typeof fields];
      const value = line.slice(separator + 1).trim();
      if (!field || !value || separator < 0) continue;
      results.push(addFact(state, { field, value, origin: 'documental', evidence: { documentId: document.id, page: pageIndex + 1, quote: line.trim() } }));
    }
  }
  return results;
}
