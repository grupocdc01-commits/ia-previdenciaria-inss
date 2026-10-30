import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleDocumentModule } from "@/lib/api/document-dossier.server";
import { fixtureDoc, DOC, OWNER, THREAD } from "./fixtures/document-dossier";
const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/api/request-auth.server", () => ({ authenticateRequest: mocks.auth }));
import { Route } from "@/routes/api/document-dossier";
const post = (
  Route.options as unknown as {
    server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } };
  }
).server.handlers.POST;
const request = (body: unknown) =>
  new Request("https://local.invalid/api/document-dossier", {
    method: "POST",
    body: JSON.stringify(body),
  });
const payload = () => ({
  operation: "review",
  documentId: DOC,
  sha256: "a".repeat(64),
  extractionVersion: "administrative-v1",
  expectedRevision: 1,
  decisions: ["confirmed", "rejected", "pending"],
});
let doc = fixtureDoc();
let docs = [doc];
let owner = OWNER;
let rpc = vi.fn();
let auth: Parameters<typeof handleDocumentModule>[1];
beforeEach(() => {
  vi.stubEnv("DOCUMENT_DOSSIER_ENABLED", "true");
  vi.useRealTimers();
  doc = fixtureDoc();
  docs = [doc];
  owner = OWNER;
  rpc = vi.fn().mockResolvedValue({ data: { revision: 2, duplicate: false }, error: null });
  auth = {
    userId: OWNER,
    client: {
      rpc,
      from: (table: string) => {
        const chain = {
          select: () => chain,
          eq: () => chain,
          single: async () => ({
            data: table === "investigations" ? { user_id: owner } : doc,
            error: null,
          }),
          limit: async () => ({ data: docs, error: null }),
        };
        return chain;
      },
    },
  } as unknown as Parameters<typeof handleDocumentModule>[1];
  mocks.auth.mockReset().mockResolvedValue(auth);
});
describe("module 3 authenticated API offline", () => {
  it("saves literal decisions only through the atomic RPC, with no external call", async () => {
    const result = await handleDocumentModule(request(payload()), auth);
    expect(result.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "review_document_fields",
      expect.objectContaining({
        p_document: DOC,
        p_expected_revision: 1,
        p_extraction: doc.extraction,
        p_decisions: ["confirmed", "rejected", "pending"],
      }),
    );
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("is disabled by default before authenticating", async () => {
    vi.stubEnv("DOCUMENT_DOSSIER_ENABLED", "");
    expect((await post({ request: request(payload()) })).status).toBe(503);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("requires a session and handles unavailable authentication safely", async () => {
    mocks.auth.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("synthetic secret"));
    expect((await post({ request: request(payload()) })).status).toBe(401);
    const result = await post({ request: request(payload()) });
    expect(result.status).toBe(503);
    expect(await result.text()).not.toContain("synthetic secret");
  });
  it.each([
    { decisions: ["confirmed"] },
    { sha256: "fake" },
    { expectedRevision: -1 },
    { decisions: ["proven"] },
    { unexpected: "value" },
  ])("rejects malformed review %j", async (patch) => {
    expect((await handleDocumentModule(request({ ...payload(), ...patch }), auth)).status).toBe(
      400,
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it("bounds streamed JSON even without a content-length and rejects malformed JSON", async () => {
    expect(
      (await handleDocumentModule(request({ padding: "x".repeat(131073) }), auth)).status,
    ).toBe(413);
    expect(
      (
        await handleDocumentModule(
          new Request("https://local.invalid/", { method: "POST", body: "{" }),
          auth,
        )
      ).status,
    ).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects a changed hash or extraction version before committing", async () => {
    expect(
      (await handleDocumentModule(request({ ...payload(), sha256: "b".repeat(64) }), auth)).status,
    ).toBe(409);
    expect(
      (await handleDocumentModule(request({ ...payload(), extractionVersion: "changed" }), auth))
        .status,
    ).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects cross-owner, expired and deleting documents", async () => {
    for (const patch of [
      { user_id: DOC },
      { delete_after: "2000-01-01T00:00:00Z" },
      { deletion_state: "deleting" },
    ]) {
      doc = fixtureDoc(patch);
      expect((await handleDocumentModule(request(payload()), auth)).status).toBe(404);
    }
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects medical or malformed extraction rather than confirming it", async () => {
    for (const extraction of [
      { documentType: "medico", fields: [], limitations: [] },
      { bad: "payload" },
    ]) {
      doc = fixtureDoc({ extraction });
      expect(
        (await handleDocumentModule(request({ ...payload(), decisions: [] }), auth)).status,
      ).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    ["40001", 409],
    ["P0002", 404],
    ["42501", 403],
    ["22023", 400],
    ["PGRST202", 503],
    ["unknown", 500],
  ])("maps database error %s to %s without leaking details", async (code, status) => {
    rpc.mockResolvedValue({ data: null, error: { code, message: "synthetic secret" } });
    const response = await handleDocumentModule(request(payload()), auth);
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("synthetic secret");
  });
  it("generates an empty dossier without requiring documents, AI or legal computations", async () => {
    docs = [];
    const result = await handleDocumentModule(
      request({ operation: "dossier", threadId: THREAD, periods: [] }),
      auth,
    );
    expect(result.status).toBe(200);
    expect((await result.json()).dossier.canConclude).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("filters another owner's documents and refuses another owner's investigation", async () => {
    docs = [fixtureDoc({ user_id: DOC })];
    const result = await handleDocumentModule(
      request({ operation: "dossier", threadId: THREAD, periods: [] }),
      auth,
    );
    expect((await result.json()).dossier.documents).toEqual([]);
    owner = DOC;
    expect(
      (
        await handleDocumentModule(
          request({ operation: "dossier", threadId: THREAD, periods: [] }),
          auth,
        )
      ).status,
    ).toBe(404);
  });
  it("rejects excessive document volume explicitly instead of silently truncating", async () => {
    docs = Array.from({ length: 101 }, () => fixtureDoc());
    expect(
      (
        await handleDocumentModule(
          request({ operation: "dossier", threadId: THREAD, periods: [] }),
          auth,
        )
      ).status,
    ).toBe(503);
  });
});
