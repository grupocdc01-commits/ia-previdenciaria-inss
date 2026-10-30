import { createHash, webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleAnamnesisRequest, type AnamnesisAuth } from "@/lib/api/anamnesis.server";
import { newInvestigationFacts } from "@/lib/anamnesis";
import { interviewRequestSchema } from "@/lib/anamnesis-schema";

const mocks = vi.hoisted(() => ({ authenticate: vi.fn() }));
vi.mock("@/lib/api/request-auth.server", () => ({ authenticateRequest: mocks.authenticate }));
import { Route } from "@/routes/api/anamnese";
const post = (
  Route.options as unknown as {
    server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } };
  }
).server.handlers.POST;
const ID = "00000000-0000-4000-8000-000000000001";
const stamp = "2026-10-30T00:00:00Z";
const payload = () => ({
  threadId: ID,
  requestId: "00000000-0000-4000-8000-000000000002",
  expectedUpdatedAt: stamp,
  action: { kind: "story", text: "Relato fictício", finish: false },
});
const request = (body: unknown) =>
  new Request("https://local.invalid/api/anamnese", { method: "POST", body: JSON.stringify(body) });
let rpc: ReturnType<typeof vi.fn>;
let prior: { request_hash: string } | null;
let ledgerError: { code: string } | null;
let owner: string;
let updated: string;
let auth: AnamnesisAuth;
beforeEach(() => {
  Object.defineProperty(crypto, "subtle", { configurable: true, value: webcrypto.subtle });
  vi.stubEnv("ANAMNESIS_V2_ENABLED", "true");
  owner = "synthetic-owner";
  updated = stamp;
  prior = null;
  ledgerError = null;
  rpc = vi.fn().mockResolvedValue({ data: { duplicate: false, updatedAt: stamp }, error: null });
  auth = {
    userId: "synthetic-owner",
    client: {
      rpc,
      from: (table: string) => {
        const chain = {
          select: () => chain,
          eq: () => chain,
          single: async () => ({
            data: {
              id: ID,
              user_id: owner,
              updated_at: updated,
              benefit: null,
              facts: newInvestigationFacts(true),
            },
            error: null,
          }),
          maybeSingle: async () => ({
            data: table === "anamnesis_turns" ? prior : null,
            error: ledgerError,
          }),
        };
        return chain;
      },
    },
  } as unknown as AnamnesisAuth;
  mocks.authenticate.mockResolvedValue(auth);
});
describe("anamnesis API offline", () => {
  it("commits only through the atomic RPC with no AI or external fetch", async () => {
    const result = await handleAnamnesisRequest(request(payload()), auth);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ ok: true, duplicate: false });
    expect(rpc).toHaveBeenCalledWith(
      "commit_anamnesis_turn",
      expect.objectContaining({
        p_investigation: ID,
        p_user_text: "Relato fictício",
        p_facts: expect.objectContaining({ story: ["Relato fictício"], storyStatus: "collecting" }),
      }),
    );
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps the feature disabled by default without trying authentication", async () => {
    vi.stubEnv("ANAMNESIS_V2_ENABLED", "");
    mocks.authenticate.mockClear();
    expect((await post({ request: request(payload()) })).status).toBe(503);
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });
  it("rejects missing authentication", async () => {
    mocks.authenticate.mockResolvedValue(null);
    expect((await post({ request: request(payload()) })).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    { action: { kind: "story", text: "x".repeat(4001), finish: false } },
    { threadId: "not-uuid" },
    { unexpected: true },
  ])("rejects invalid request %j before commit", async (patch) => {
    expect((await handleAnamnesisRequest(request({ ...payload(), ...patch }), auth)).status).toBe(
      400,
    );
    expect(rpc).not.toHaveBeenCalled();
  });
  it("bounds even a body without a content-length header", async () => {
    expect(
      (await handleAnamnesisRequest(request({ padding: "x".repeat(65537) }), auth)).status,
    ).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("handles malformed JSON without disclosing transport details", async () => {
    const response = await handleAnamnesisRequest(
      new Request("https://local.invalid/", { method: "POST", body: "{" }),
      auth,
    );
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects stale versions and cross-owner data before commit", async () => {
    updated = "2026-10-30T00:01:00Z";
    expect((await handleAnamnesisRequest(request(payload()), auth)).status).toBe(409);
    owner = "another-synthetic-owner";
    expect((await handleAnamnesisRequest(request(payload()), auth)).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("acknowledges an identical retry but rejects a reused id with changed content", async () => {
    const parsed = interviewRequestSchema.parse(payload());
    prior = {
      request_hash: createHash("sha256")
        .update(
          JSON.stringify({ expectedUpdatedAt: parsed.expectedUpdatedAt, action: parsed.action }),
        )
        .digest("hex"),
    };
    const response = await handleAnamnesisRequest(request(payload()), auth);
    expect(await response.json()).toEqual({ ok: true, duplicate: true });
    expect(
      (
        await handleAnamnesisRequest(
          request({ ...payload(), action: { ...payload().action, text: "Changed" } }),
          auth,
        )
      ).status,
    ).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    ["40001", 409],
    ["P0002", 404],
    ["42501", 403],
    ["22023", 400],
    ["PGRST202", 503],
    ["unknown", 500],
  ])("maps database error %s to %s without exposing internals", async (code, status) => {
    rpc.mockResolvedValue({
      data: null,
      error: { code, message: "synthetic secret database detail" },
    });
    const response = await handleAnamnesisRequest(request(payload()), auth);
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("synthetic secret");
  });
  it("fails safely if the reviewed migration has not been installed", async () => {
    ledgerError = { code: "PGRST205" };
    expect((await handleAnamnesisRequest(request(payload()), auth)).status).toBe(503);
    expect(rpc).not.toHaveBeenCalled();
  });
});
