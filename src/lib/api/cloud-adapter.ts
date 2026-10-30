import { DefaultChatTransport } from "ai";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import {
  listInvestigations,
  createInvestigation,
  getInvestigation,
  getInvestigationPanel,
  skipDocuments,
} from "./investigation.functions";
import { ApiError, type CaseAdapter, type Analysis, type Job } from "./types";
import {
  privateProcessingStatus,
  saveProcessingPreferences,
  validateGeminiModels,
  listPrivateDocuments,
  openPrivateDocument,
  deletePrivateDocument,
  extractPrivateDocument,
} from "./document.functions";

export class CloudCaseAdapter implements CaseAdapter {
  readonly mode = "cloud" as const;
  list = listInvestigations;
  create = createInvestigation;
  get = getInvestigation;
  panel = getInvestigationPanel;
  skipDocuments = skipDocuments;
  processingStatus = privateProcessingStatus;
  savePreferences = saveProcessingPreferences;
  validateModels = validateGeminiModels;
  privateDocuments = listPrivateDocuments;
  openPrivate = openPrivateDocument;
  deletePrivate = deletePrivateDocument;
  extractPrivate = extractPrivateDocument;
  async uploadPrivate(threadId: string, file: File) {
    const body = new FormData();
    body.append("threadId", threadId);
    body.append("file", file);
    const response = await fetch("/api/private-document-upload", {
      method: "POST",
      headers: await this.headers(),
      body,
    });
    const result = (await response.json()) as { error?: string; id?: string; duplicate?: boolean };
    if (!response.ok) throw new Error(result.error ?? "Não foi possível enviar.");
    return result;
  }
  async analyze(): Promise<Job> {
    throw new Error("O motor jurídico ainda não está validado.");
  }
  async getJob(): Promise<Job> {
    throw new Error("Não há análise jurídica em execução.");
  }
  async getAnalysis(): Promise<Analysis> {
    throw new Error("Investigação jurídica completa ainda indisponível.");
  }
  async user() {
    const { data, error } = await supabase.auth.getUser();
    return error ? null : data.user;
  }
  onAuthChange = supabase.auth.onAuthStateChange.bind(supabase.auth);
  async login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error)
      throw new Error("Não foi possível entrar. Confira e-mail, senha e confirmação da conta.");
  }
  async signup(email: string, password: string, name: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth`, data: { display_name: name } },
    });
    if (error)
      throw new Error("Não foi possível criar a conta. Confira seus dados e tente novamente.");
    return Boolean(data.session);
  }
  async social(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) throw new Error("Não foi possível entrar com essa conta.");
    return result.redirected;
  }
  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw new Error("Não foi possível enviar o link de recuperação.");
  }
  async updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error("Não foi possível atualizar a senha. Solicite um novo link.");
  }
  async signout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error("Não foi possível sair da conta.");
  }
  async headers() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new ApiError("unauthorized", "Entre na sua conta.");
    return { Authorization: `Bearer ${data.session.access_token}` };
  }
  transport(threadId: string) {
    return new DefaultChatTransport({
      api: "/api/investigation-chat",
      headers: () => this.headers(),
      body: { threadId },
    });
  }
  async transcribe(audio: Blob, signal?: AbortSignal) {
    const body = new FormData();
    body.append("audio", audio, audio.type.includes("mp4") ? "gravacao.m4a" : "gravacao.webm");
    const response = await fetch("/api/investigation-transcription", {
      method: "POST",
      headers: await this.headers(),
      body,
      ...(signal ? { signal } : {}),
    });
    const result: { text?: string; error?: string } = await response.json();
    if (!response.ok || !result.text)
      throw new Error(
        result.error ??
          "A transcrição não está configurada ou está indisponível. Escreva sua resposta.",
      );
    return result.text;
  }
  async documents(threadId: string) {
    const user = await this.user();
    if (!user) throw new Error("Entre na sua conta.");
    const { data, error } = await supabase.storage
      .from("investigation-documents")
      .list(`${user.id}/${threadId}`, { limit: 1000 });
    if (error) throw new Error("Não foi possível carregar os documentos.");
    return data
      .filter((file) => file.id)
      .map((file) => ({ name: file.name, path: `${user.id}/${threadId}/${file.name}` }));
  }
  async upload(threadId: string, file: File) {
    if (file.type !== "application/pdf" && !file.type.startsWith("image/"))
      throw new Error("Envie uma foto ou um PDF.");
    const user = await this.user();
    if (!user) throw new Error("Entre na sua conta.");
    const safeName = file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_");
    const { error } = await supabase.storage
      .from("investigation-documents")
      .upload(`${user.id}/${threadId}/${crypto.randomUUID()}_${safeName}`, file, {
        upsert: false,
        contentType: file.type,
      });
    if (error)
      throw new Error(
        "Não foi possível enviar o documento. Confira o formato e o tamanho permitido.",
      );
  }
  async openDocument(path: string) {
    const { data, error } = await supabase.storage
      .from("investigation-documents")
      .createSignedUrl(path, 60);
    if (error) throw new Error("Não foi possível abrir o documento.");
    return data.signedUrl;
  }
  async deleteDocument(path: string) {
    const { error } = await supabase.storage.from("investigation-documents").remove([path]);
    if (error) throw new Error("Não foi possível excluir o documento.");
  }
}
export const cloudAdapter = new CloudCaseAdapter();
