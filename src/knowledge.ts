import { sourceSchema } from './domain.ts';
import type { Citation, Source } from './domain.ts';

// Embeddings de demonstração, locais e determinísticos. Não representam pesquisa semântica de produção.
export interface Embedder { embed(text: string): number[] }
export class DemoEmbedder implements Embedder {
  embed(text: string): number[] {
    const vector = Array<number>(16).fill(0);
    for (const token of tokens(text)) {
      let hash = 0;
      for (const char of token) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
      const index = hash % vector.length;
      vector[index] = (vector[index] ?? 0) + 1;
    }
    return vector;
  }
}
function tokens(text: string): string[] { return text.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '').match(/[a-z0-9]+/g) ?? []; }
function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  const norm = Math.hypot(...a) * Math.hypot(...b);
  return norm ? a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0) / norm : 0;
}
export class KnowledgeBase {
  sources: Source[];
  embedder: Embedder;
  constructor(sources: Source[], embedder: Embedder = new DemoEmbedder()) {
    this.sources = sources.map(source => sourceSchema.parse(source));
    this.embedder = embedder;
  }
  search(query: string, options: { benefit: string; date: string | null; uf: string; mode: 'demonstracao' | 'real' }): Source[] {
    if (!options.date) return [];
    const vector = this.embedder.embed(query);
    const terms = new Set(tokens(query));
    // Aprovação, vigência e jurisdição são filtros anteriores ao ranking.
    return this.sources.filter(source => source.benefit === options.benefit &&
      source.validFrom <= options.date! && (source.validTo === null || source.validTo >= options.date!) &&
      (source.jurisdiction === 'nacional' || source.jurisdiction === options.uf) &&
      (options.mode === 'demonstracao' ? source.demonstration : !source.demonstration && source.approval === 'approved' && source.legalValidityVerified && source.authority !== 'demonstracao'))
      .map(source => {
        const words = new Set(tokens(source.text));
        const lexical = [...terms].filter(word => words.has(word)).length / Math.max(terms.size, 1);
        return { source, lexical, score: lexical * 0.7 + cosine(vector, source.vector) * 0.3 };
      })
      .filter(result => result.lexical > 0)
      .sort((a, b) => b.score - a.score || a.source.id.localeCompare(b.source.id))
      .slice(0, 5).map(result => result.source);
  }
}
export function citationFor(source: Source): Citation {
  return { sourceId: source.id, version: source.version, url: source.url, anchor: source.anchor, quote: source.text, demonstration: source.demonstration };
}
export function verifyCitation(citation: Citation, sources: Source[]): boolean {
  return citation.quote.trim().length > 0 && sources.some(source => source.id === citation.sourceId && source.version === citation.version && source.url === citation.url && source.anchor === citation.anchor && source.demonstration === citation.demonstration && source.text.includes(citation.quote));
}
export function demoKnowledge(): KnowledgeBase {
  const embedder = new DemoEmbedder();
  const text = 'DEMONSTRAÇÃO SEM VALOR JURÍDICO: BPC, renda e composição familiar são temas para perguntas. Este texto fictício não estabelece requisitos, valores legais ou direito ao benefício.';
  return new KnowledgeBase([{
    id: 'demo-bpc', version: '1', title: 'DEMONSTRAÇÃO: investigação de informações familiares',
    url: 'https://example.invalid/demo/bpc', text, anchor: 'demo-paragrafo-1', benefit: 'bpc',
    validFrom: '2000-01-01', validTo: null, approval: 'draft', legalValidityVerified: false,
    demonstration: true, jurisdiction: 'nacional', authority: 'demonstracao', vector: embedder.embed(text)
  }], embedder);
}
