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
import cors from '@fastify/cors';
import type { CaseRepository } from './infra/repository.ts';
import { AnalysisQueue, publicJob } from './infra/queue.ts';
import type { PrivateObjects } from './infra/objects.ts';
import { S3PrivateObjects } from './infra/objects.ts';
import { createHash, randomUUID } from 'node:crypto';

declare module 'fastify' { interface FastifyRequest { ownerId: string } }
export function buildApp(options: {
  store?: CaseRepository; tokens?: Record<string, string>; authenticate?: (token: string) => Promise<string>;
  investigator?: AnalysisProvider; logger?: boolean; corsOrigins?: string[];
  queue?: AnalysisQueue; objects?: PrivateObjects;
  researchResources?: unknown;
  consumeQuota?: (ownerId: string) => Promise<boolean>; ready?: () => Promise<void>;
  library?: { catalog: unknown; archiveRoot: string; curators: string[]; researchResources?: unknown; database?: Store['db'] }
}) {
  const tokens = Object.entries(options.tokens ?? {});
  if ((!tokens.length && !options.authenticate) || tokens.some(([token, owner]) => token.length < 24 || !owner.trim())) throw new Error('Configure autenticação JWT ou tokens locais de pelo menos 24 caracteres.');
  if (options.queue && !options.objects) throw new Error('Fila exige armazenamento privado de relatórios.');
  const store = options.store ?? new Store();
  const investigator = options.investigator ?? new DemoInvestigator();
  const libraryDb = options.library?.database ?? (store instanceof Store ? store.db : undefined);
  if (options.library && !libraryDb) throw new Error('Configure banco separado para a biblioteca.');
  const library = options.library ? new LegalLibrary(libraryDb!, options.library.catalog, options.library.archiveRoot) : null;
  const resources = options.library?.researchResources ?? options.researchResources;
  if (resources !== undefined) researchResources(resources);
  const app = Fastify({ bodyLimit: 150_000, logger: options.logger ? { redact: ['req.headers.authorization'], serializers: { req: req => ({ method: req.method, route: req.routeOptions?.url }) } } : false, logController: new LogController({ disableRequestLogging: true }) });
  if (options.corsOrigins?.length) {
    for (const origin of options.corsOrigins) if (new URL(origin).origin !== origin) throw new Error('Origem CORS inválida.');
    void app.register(cors, { origin: options.corsOrigins, methods: ['GET','POST','PATCH','OPTIONS'], allowedHeaders: ['Authorization','Content-Type'], exposedHeaders: ['Location','Retry-After'], maxAge: 600 });
  }
  app.decorateRequest('ownerId', '');
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
    if ((request.url === '/health' || request.url === '/ready') && request.method === 'GET' || request.method === 'OPTIONS') return;
    const supplied = Buffer.from(request.headers.authorization?.replace(/^Bearer /, '') ?? '');
    const match = tokens.find(([token]) => { const expected = Buffer.from(token); return supplied.length === expected.length && timingSafeEqual(supplied, expected); });
    if (!request.headers.authorization?.startsWith('Bearer ')) throw new DomainError('Autenticação necessária.', 401);
    if (options.authenticate) {
      try { request.ownerId = await options.authenticate(supplied.toString()); }
      catch { throw new DomainError('Sessão inválida ou expirada.', 401); }
    } else {
      if (!match) throw new DomainError('Autenticação necessária.', 401);
      request.ownerId = match[1];
    }
    if (options.consumeQuota && !(await options.consumeQuota(request.ownerId))) {
      reply.header('Retry-After', '60'); throw new DomainError('Limite de solicitações atingido. Aguarde um minuto.', 429);
    }
  });
  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, _request, reply) => {
    if (error instanceof ZodError) return reply.code(400).send({ error: 'Entrada inválida.', fields: error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message })) });
    const code = error instanceof DomainError ? error.statusCode : error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    if (code === 500) app.log.error({ failureCode: error.code ?? error.name }, 'Falha interna sem conteúdo de documentos.');
    // Não enviar stack, corpo, SQL ou conteúdo de documentos na resposta.
    return reply.code(code).send({ error: code === 500 ? 'Falha interna no processamento.' : error.message });
  });
  const params = (raw: unknown) => z.object({ id: z.uuid() }).parse(raw).id;
  app.get('/health', async () => ({ status: 'ok', mode: 'demonstracao', realLegalAnalysisEnabled: false }));
  app.get('/capabilities', async () => ({ syntheticDataOnly: true, realLegalAnalysisEnabled: false, queuedAnalysis: Boolean(options.queue), documentInput: 'synthetic_text', binaryUpload: options.objects instanceof S3PrivateObjects ? 'quarantine_only' : 'unavailable' }));
  app.get('/ready', async (_request, reply) => {
    try { await options.ready?.(); return { status: 'ready' }; } catch { return reply.code(503).send({ status: 'unavailable' }); }
  });
  if (resources !== undefined) {
    app.get('/library/resources', async request => {
      const input = z.object({ uf: z.string().optional() }).strict().parse(request.query);
      return researchResources(resources ?? [], input.uf);
    });
  }
  if (library) {
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
  app.post('/cases', async (request, reply) => reply.code(201).send(await store.create(request.ownerId, caseInput.parse(request.body))));
  app.get('/cases/:id', async request => store.get(params(request.params), request.ownerId));
  app.patch('/cases/:id', async request => {
    const state = await store.get(params(request.params), request.ownerId);
    const patch = z.object({
      subtype: caseInput.shape.subtype.removeDefault().optional(),
      der: caseInput.shape.der.removeDefault().optional(),
      noticeDate: caseInput.shape.noticeDate.removeDefault().optional(),
      denialReason: caseInput.shape.denialReason.removeDefault().optional()
    }).strict().refine(value => Object.keys(value).length > 0, 'Informe ao menos um campo.').parse(request.body);
    Object.assign(state.case, patch);
    await store.save(state, request.ownerId, 'case.updated');
    return { case: state.case, nextQuestion: nextQuestion(state) };
  });
  app.post('/cases/:id/documents', async (request, reply) => {
    const state = await store.get(params(request.params), request.ownerId);
    const before = state.documents.length;
    const availableBefore = state.documents.filter(d => !d.purgedAt).length;
    const document = registerDocument(state, request.body);
    const facts = state.documents.length !== before ? extractCandidateFacts(state, document) : state.facts.filter(f => f.evidence?.documentId === document.id);
    if (state.documents.length !== before || availableBefore !== state.documents.filter(d => !d.purgedAt).length) await store.save(state, request.ownerId, 'document.registered');
    return reply.code(state.documents.length !== before ? 201 : 200).send({ document, candidateFacts: facts, nextQuestion: nextQuestion(state) });
  });
  app.post('/cases/:id/facts', async (request, reply) => {
    const state = await store.get(params(request.params), request.ownerId);
    const fact = addFact(state, factInput.parse(request.body));
    await store.save(state, request.ownerId, 'fact.registered');
    return reply.code(201).send(fact);
  });
  app.post('/cases/:id/facts/:factId/confirm', async request => {
    const values = z.object({ id: z.uuid(), factId: z.uuid() }).parse(request.params);
    const state = await store.get(values.id, request.ownerId);
    const fact = state.facts.find(f => f.id === values.factId && f.origin === 'documental');
    if (!fact) throw new DomainError('Fato documental não encontrado.', 404);
    const body = z.object({ confirmed: z.literal(true) }).strict().parse(request.body);
    fact.confirmed = body.confirmed;
    await store.save(state, request.ownerId, 'fact.confirmed');
    return fact;
  });
  app.get('/cases/:id/interview', async request => ({ nextQuestion: nextQuestion(await store.get(params(request.params), request.ownerId)) }));
  app.post('/cases/:id/interview/messages', async request => {
    const state = await store.get(params(request.params), request.ownerId);
    const data = messageInput.parse(request.body);
    if (state.messages.length >= 50) throw new DomainError('Limite de 50 respostas por caso.');
    state.messages.push(data);
    addFact(state, { field: data.field, value: data.answer, origin: 'declarado' });
    await store.save(state, request.ownerId, 'interview.answered');
    return { nextQuestion: nextQuestion(state), notice: 'Resposta registrada como declaração, sem comprovação documental.' };
  });
  app.post('/cases/:id/analyze', async (request, reply) => {
    z.object({ mode: z.literal('demonstracao').default('demonstracao') }).strict().parse(request.body ?? {});
    const state = await store.get(params(request.params), request.ownerId);
    if (options.queue) {
      const job = await options.queue.enqueue(state.case.id, request.ownerId);
      return reply.code(202).header('Location', '/jobs/' + job.id).send(publicJob(await options.queue.get(job.id, request.ownerId)));
    }
    const analysis = await investigator.analyze(state);
    await store.saveAnalysis(analysis, request.ownerId);
    return analysis;
  });
  if (options.queue) {
    app.get('/jobs/:id', async request => publicJob(await options.queue!.get(params(request.params), request.ownerId)));
    if (options.objects instanceof S3PrivateObjects) {
      app.post('/cases/:id/uploads', async (request, reply) => {
        await store.get(params(request.params), request.ownerId);
        const input = z.object({ contentType: z.enum(['application/pdf','image/jpeg','image/png']), bytes: z.int().min(1).max(10_000_000) }).strict().parse(request.body);
        const owner = createHash('sha256').update(request.ownerId).digest('hex');
        // Apenas quarentena. Não transforma o arquivo em documento validado do caso.
        const key = `quarantine/${owner}/${randomUUID()}`;
        const ticket = await (options.objects as S3PrivateObjects).uploadTicket(key, input.contentType, input.bytes);
        await options.queue!.registerUpload(params(request.params), request.ownerId, key);
        return reply.code(201).send(ticket);
      });
    }
  }
  app.get('/cases/:id/analysis', async request => store.analysis(params(request.params), request.ownerId));
  app.get('/cases/:id/report', async (request, reply) => {
    if (options.queue && options.objects) {
      const key = await options.queue.reportKey(params(request.params), request.ownerId);
      return reply.type('application/pdf').header('Content-Disposition', 'attachment; filename="analise-demonstrativa.pdf"').send(await options.objects.get(key));
    }
    const analysis = await store.analysis(params(request.params), request.ownerId);
    return reply.type('application/pdf').header('Content-Disposition', 'attachment; filename="analise-demonstrativa.pdf"').send(await reportPdf(analysis));
  });
  app.addHook('onClose', async () => { await store.close(); });
  return app;
}
