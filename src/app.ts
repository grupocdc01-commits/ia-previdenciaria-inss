import Fastify, { LogController } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import { z, ZodError } from 'zod';
import { caseInput, DomainError, factInput, messageInput } from './domain.ts';
import { Store } from './storage.ts';
import { addFact, extractCandidateFacts, registerDocument } from './documents.ts';
import { nextQuestion } from './interview.ts';
import { DemoInvestigator } from './investigation.ts';
import type { AnalysisProvider } from './investigation.ts';
import { reportPdf } from './reports.ts';
import { LegalLibrary } from './library.ts';
import { researchResources } from './research-resources.ts';

declare module 'fastify' { interface FastifyRequest { ownerId: string } }
export function buildApp(options: { store?: Store; tokens: Record<string, string>; investigator?: AnalysisProvider; logger?: boolean; library?: { catalog: unknown; archiveRoot: string; curators: string[]; researchResources?: unknown } }) {
  const tokens = Object.entries(options.tokens);
  if (!tokens.length || tokens.some(([token, owner]) => token.length < 24 || !owner.trim())) throw new Error('Configure tokens locais de pelo menos 24 caracteres e seus proprietários.');
  const store = options.store ?? new Store();
  const investigator = options.investigator ?? new DemoInvestigator();
  const library = options.library ? new LegalLibrary(store.db, options.library.catalog, options.library.archiveRoot) : null;
  const resources = options.library?.researchResources;
  if (resources !== undefined) researchResources(resources);
  const app = Fastify({ bodyLimit: 150_000, logger: options.logger ? { redact: ['req.headers.authorization'], serializers: { req: req => ({ method: req.method, route: req.routeOptions?.url }) } } : false, logController: new LogController({ disableRequestLogging: true }) });
  app.decorateRequest('ownerId', '');
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
    if (request.url === '/health' && request.method === 'GET') return;
    const supplied = Buffer.from(request.headers.authorization?.replace(/^Bearer /, '') ?? '');
    const match = tokens.find(([token]) => { const expected = Buffer.from(token); return supplied.length === expected.length && timingSafeEqual(supplied, expected); });
    if (!match) throw new DomainError('Autenticação necessária.', 401);
    request.ownerId = match[1];
  });
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: 'Entrada inválida.', fields: error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) });
    const code = error instanceof DomainError ? error.statusCode : error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    // Não enviar stack, corpo, SQL ou conteúdo de documentos na resposta.
    return reply.code(code).send({ error: code === 500 ? 'Falha interna no processamento.' : error.message });
  });
  const params = (raw: unknown) => z.object({ id: z.uuid() }).parse(raw).id;
  app.get('/health', async () => ({ status: 'ok', mode: 'demonstracao', realLegalAnalysisEnabled: false }));
  if (library) {
    app.get('/library/resources', async request => {
      const input = z.object({ uf: z.string().optional() }).strict().parse(request.query);
      return researchResources(resources ?? [], input.uf);
    });
    const curator = (ownerId: string) => {
      if (!options.library!.curators.includes(ownerId)) throw new DomainError('Curadoria não autorizada.', 403);
    };
    app.get('/admin/sources', async request => { curator(request.ownerId); return library.list(); });
    app.post('/admin/sources/import', async (request, reply) => {
      curator(request.ownerId);
      const input = z.object({ sourceId: z.string().regex(/^[a-z0-9-]+$/), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict().parse(request.body);
      const result = library.importArchive(input.sourceId, input.sha256, request.ownerId);
      return reply.code(result.inserted ? 201 : 200).send(result);
    });
    app.get('/admin/sources/:sourceId/versions/:sha256', async request => {
      curator(request.ownerId);
      const input = z.object({ sourceId: z.string().regex(/^[a-z0-9-]+$/), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).parse(request.params);
      return library.get(input.sourceId, input.sha256);
    });
    app.post('/admin/sources/search', async request => { curator(request.ownerId); return library.search(request.body, true); });
    app.post('/library/search', async request => library.search(request.body));
    // Nenhuma rota ou token desta fase pode aprovar fontes juridicamente.
  }
  app.post('/cases', async (request, reply) => reply.code(201).send(store.create(request.ownerId, caseInput.parse(request.body))));
  app.get('/cases/:id', async request => store.get(params(request.params), request.ownerId));
  app.patch('/cases/:id', async request => {
    const state = store.get(params(request.params), request.ownerId);
    const patch = z.object({
      subtype: caseInput.shape.subtype.removeDefault().optional(),
      der: caseInput.shape.der.removeDefault().optional(),
      noticeDate: caseInput.shape.noticeDate.removeDefault().optional(),
      denialReason: caseInput.shape.denialReason.removeDefault().optional()
    }).strict().refine(value => Object.keys(value).length > 0, 'Informe ao menos um campo.').parse(request.body);
    Object.assign(state.case, patch);
    store.save(state, request.ownerId, 'case.updated');
    return { case: state.case, nextQuestion: nextQuestion(state) };
  });
  app.post('/cases/:id/documents', async (request, reply) => {
    const state = store.get(params(request.params), request.ownerId);
    const before = state.documents.length;
    const document = registerDocument(state, request.body);
    const facts = state.documents.length !== before ? extractCandidateFacts(state, document) : state.facts.filter(f => f.evidence?.documentId === document.id);
    if (state.documents.length !== before) store.save(state, request.ownerId, 'document.registered');
    return reply.code(state.documents.length !== before ? 201 : 200).send({ document, candidateFacts: facts, nextQuestion: nextQuestion(state) });
  });
  app.post('/cases/:id/facts', async (request, reply) => {
    const state = store.get(params(request.params), request.ownerId);
    const fact = addFact(state, factInput.parse(request.body));
    store.save(state, request.ownerId, 'fact.registered');
    return reply.code(201).send(fact);
  });
  app.post('/cases/:id/facts/:factId/confirm', async request => {
    const values = z.object({ id: z.uuid(), factId: z.uuid() }).parse(request.params);
    const state = store.get(values.id, request.ownerId);
    const fact = state.facts.find(f => f.id === values.factId && f.origin === 'documental');
    if (!fact) throw new DomainError('Fato documental não encontrado.', 404);
    const body = z.object({ confirmed: z.literal(true) }).strict().parse(request.body);
    fact.confirmed = body.confirmed;
    store.save(state, request.ownerId, 'fact.confirmed');
    return fact;
  });
  app.get('/cases/:id/interview', async request => ({ nextQuestion: nextQuestion(store.get(params(request.params), request.ownerId)) }));
  app.post('/cases/:id/interview/messages', async request => {
    const state = store.get(params(request.params), request.ownerId);
    const data = messageInput.parse(request.body);
    if (state.messages.length >= 50) throw new DomainError('Limite de 50 respostas por caso.');
    state.messages.push(data);
    addFact(state, { field: data.field, value: data.answer, origin: 'declarado' });
    store.save(state, request.ownerId, 'interview.answered');
    return { nextQuestion: nextQuestion(state), notice: 'Resposta registrada como declaração, sem comprovação documental.' };
  });
  app.post('/cases/:id/analyze', async request => {
    z.object({ mode: z.literal('demonstracao').default('demonstracao') }).strict().parse(request.body ?? {});
    const state = store.get(params(request.params), request.ownerId);
    const analysis = investigator.analyze(state);
    store.saveAnalysis(analysis, request.ownerId);
    return analysis;
  });
  app.get('/cases/:id/analysis', async request => store.analysis(params(request.params), request.ownerId));
  app.get('/cases/:id/report', async (request, reply) => {
    const analysis = store.analysis(params(request.params), request.ownerId);
    return reply.type('application/pdf').header('Content-Disposition', 'attachment; filename="analise-demonstrativa.pdf"').send(await reportPdf(analysis));
  });
  app.addHook('onClose', async () => store.close());
  return app;
}
