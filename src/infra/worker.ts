import { createHash } from 'node:crypto';
import { DemoInvestigator } from '../investigation.ts';
import type { AnalysisProvider } from '../investigation.ts';
import { reportPdf } from '../reports.ts';
import type { PrivateObjects } from './objects.ts';
import { AnalysisQueue } from './queue.ts';
import { getCase } from './repository.ts';

export async function workOnce(queue: AnalysisQueue, objects: PrivateObjects, provider: AnalysisProvider = new DemoInvestigator()) {
  const job = await queue.claim();
  if (!job) return false;
  const owner = createHash('sha256').update(job.ownerId).digest('hex');
  const key = `reports/${owner}/${job.id}/${job.leaseToken}.pdf`;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let renewing = false;
  try {
    heartbeat = setInterval(() => {
      if (renewing) return;
      renewing = true;
      void queue.heartbeat(job).catch(() => false).finally(() => { renewing = false; });
    }, Math.max(10, Math.floor(queue.leaseMs / 3)));
    heartbeat.unref();
    const state = await getCase(queue.db, job.caseId, job.ownerId);
    if (state.case.revision !== job.revision) throw new Error('Revisão alterada.');
    const cached = (await queue.db.query('SELECT result FROM analyses WHERE case_id=$1', [job.caseId])).rows[0];
    const previous = cached ? JSON.parse(String(cached.result)) as import('../domain.ts').Analysis : null;
    const analysis = previous?.audit.caseRevision === state.case.revision ? previous : await provider.analyze(state);
    const pdf = await reportPdf(analysis);
    await queue.reserveTemporaryObject(key);
    await objects.put(key, pdf, 'application/pdf');
    if (!(await queue.complete(job, analysis, key))) await objects.delete(key);
  } catch {
    await objects.delete(key).catch(() => {});
    await queue.fail(job);
  } finally { if (heartbeat) clearInterval(heartbeat); }
  return true;
}
