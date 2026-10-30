// Tipos espelhando o fluxo descrito (GET /cases/:id, /jobs/:id, /cases/:id/analysis).
// Confirmar contra docs/openapi.json do repositório antes de integrar.

export type JobStatus = "received" | "queued" | "processing" | "completed" | "failed" | "cancelled";

export const JOB_LABEL: Record<JobStatus, string> = {
  received: "Recebido",
  queued: "Na fila",
  processing: "Em processamento",
  completed: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado por alteração dos dados",
};

export interface Job {
  id: string;
  status: JobStatus;
  pollAfterMs?: number;
}

export interface TimelineEvent {
  data: string;
  fato: string;
  origem: "declarado" | "documentado";
}

export interface Analysis {
  caseId: string;
  resumo: string;
  urgencias: string[];
  linhaDoTempo: TimelineEvent[];
  documentosAnalisados: string[];
  fatosDeclarados: string[];
  fatosComprovados: string[];
  motivoInss: string | null;
  explicacao: string;
  inconsistencias: string[];
  fundamentosFavoraveis: string[];
  fundamentosContrarios: string[];
  limitacoes: string[];
  proximosPassos: string[];
  fontes: string[];
  dataAnalise: string;
  preparoAdvogado: {
    disponiveis: string[];
    faltantes: { nome: string; porque: string; onde: string }[];
    perguntas: string[];
  };
  pdf: { disponivel: boolean; expiraEm: string | null };
}

export type ApiErrorKind = "unauthorized" | "conflict" | "rate_limited" | "not_found" | "network" | "unknown";

export class ApiError extends Error {
  constructor(public kind: ApiErrorKind, message: string, public retryAfterSec?: number) {
    super(message);
  }
}

export const API_ERROR_MESSAGE: Record<ApiErrorKind, string> = {
  unauthorized: "Sua sessão expirou ou é inválida. Entre novamente.",
  conflict: "Os dados foram alterados. Recarregue antes de salvar.",
  rate_limited: "Limite de solicitações atingido. Aguarde um pouco.",
  not_found: "Relatório ainda indisponível, invalidado ou expirado.",
  network: "Não foi possível conectar. Verifique sua internet.",
  unknown: "Algo deu errado. Tente novamente.",
};

export interface CaseAdapter {
  readonly mode: "demo" | "http" | "cloud";
  analyze(caseId: string): Promise<Job>;
  getJob(jobId: string): Promise<Job>;
  getAnalysis(caseId: string): Promise<Analysis>;
}
