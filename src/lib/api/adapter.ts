import { findDemo } from "../demo-cases";
import { ApiError, type Analysis, type CaseAdapter, type Job, type JobStatus } from "./types";

/**
 * Adaptador demonstrativo: não faz chamadas de rede. Simula a progressão do job
 * sem percentual nem tempo estimado.
 */
class DemoAdapter implements CaseAdapter {
  readonly mode = "demo" as const;
  private jobs = new Map<string, { caseId: string; step: number }>();
  private order: JobStatus[] = ["received", "queued", "processing", "completed"];

  async analyze(caseId: string): Promise<Job> {
    const id = `job-${caseId}-${Date.now()}`;
    this.jobs.set(id, { caseId, step: 0 });
    return { id, status: "received", pollAfterMs: 1500 };
  }
  async getJob(jobId: string): Promise<Job> {
    const j = this.jobs.get(jobId);
    if (!j) throw new ApiError("not_found", "job");
    j.step = Math.min(j.step + 1, this.order.length - 1);
    return { id: jobId, status: this.order[j.step] ?? "completed", pollAfterMs: 1500 };
  }
  async getAnalysis(caseId: string): Promise<Analysis> {
    const d = findDemo(caseId) ?? findDemo("demo-crianca")!;
    return { ...d.analysis, caseId };
  }
}

/**
 * Adaptador HTTP — ainda NÃO integrado. Preparado para VITE_API_BASE_URL e
 * token do provedor JWT (não configurado). Não é usado enquanto não houver sessão.
 */
export class HttpAdapter implements CaseAdapter {
  readonly mode = "http" as const;
  constructor(private baseUrl: string, private getToken: () => string | null) {}

  private async req<T>(path: string, init?: RequestInit): Promise<T> {
    const token = this.getToken();
    if (!token) throw new ApiError("unauthorized", "sem sessão");
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers },
      });
    } catch {
      throw new ApiError("network", "rede");
    }
    if (res.status === 401) throw new ApiError("unauthorized", "401");
    if (res.status === 409) throw new ApiError("conflict", "409");
    if (res.status === 429) {
      const ra = Number(res.headers.get("Retry-After"));
      throw new ApiError("rate_limited", "429", Number.isFinite(ra) ? ra : undefined);
    }
    if (res.status === 404) throw new ApiError("not_found", "404");
    if (!res.ok) throw new ApiError("unknown", String(res.status));
    return res.json() as Promise<T>;
  }
  analyze(caseId: string) {
    return this.req<Job>(`/cases/${encodeURIComponent(caseId)}/analyze`, { method: "POST" });
  }
  getJob(jobId: string) {
    return this.req<Job>(`/jobs/${encodeURIComponent(jobId)}`);
  }
  getAnalysis(caseId: string) {
    return this.req<Analysis>(`/cases/${encodeURIComponent(caseId)}/analysis`);
  }
}

export const API_BASE_URL = import.meta.env["VITE_API_BASE_URL"] as string | undefined;

// Enquanto o login JWT não existir, sempre modo demonstrativo.
export const adapter: CaseAdapter = new DemoAdapter();

export const TERMINAL: JobStatus[] = ["completed", "failed", "cancelled"];
