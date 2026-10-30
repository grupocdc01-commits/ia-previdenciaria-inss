import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  upload: vi.fn(),
  insert: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/lib/api/request-auth.server", () => ({ authenticateRequest: mocks.authenticate }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
    from: () => ({ insert: mocks.insert }),
  },
}));
import { Route } from "@/routes/api/private-document-upload";

const post = (
  Route.options as unknown as {
    server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } };
  }
).server.handlers.POST;

function request(threadId = "00000000-0000-4000-8000-000000000001", name = "test.pdf") {
  const file = new File(["%PDF-1.4"], name, { type: "application/pdf" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => new TextEncoder().encode("%PDF-1.4").buffer,
  });
  return {
    headers: new Headers(),
    formData: async () => ({ get: (key: string) => (key === "threadId" ? threadId : file) }),
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000002");
  // jsdom has no SubtleCrypto; use Node's local cryptography, never a service.
  Object.defineProperty(crypto, "subtle", { configurable: true, value: webcrypto.subtle });
  mocks.authenticate.mockResolvedValue({
    userId: "synthetic-user",
    client: {
      from: () => {
        const query = {
          select: () => query,
          eq: () => query,
          single: async () => ({ data: { id: "synthetic-thread" }, error: null }),
          maybeSingle: async () => ({ data: null, error: null }),
        };
        return query;
      },
    },
  });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
});

describe("offline upload regression", () => {
  it("stores a sanitized original name after a normal upload", async () => {
    const response = await post({ request: request(undefined, "folder\\test.pdf") });
    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ original_name: "folder_test.pdf" }),
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated requests before reading files or storing bytes", async () => {
    mocks.authenticate.mockResolvedValue(null);
    expect((await post({ request: request() })).status).toBe(401);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("rejects invalid investigation identifiers before upload", async () => {
    expect((await post({ request: request("invalid") })).status).toBe(400);
    expect(mocks.upload).not.toHaveBeenCalled();
  });
  it("reports storage failure without creating metadata", async () => {
    mocks.upload.mockResolvedValue({ error: new Error("synthetic failure") });
    const response = await post({ request: request() });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Não foi possível enviar o arquivo." });
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("removes the new object if saving metadata fails", async () => {
    mocks.insert.mockResolvedValue({ error: new Error("synthetic failure") });
    expect((await post({ request: request() })).status).toBe(400);
    expect(mocks.remove).toHaveBeenCalledOnce();
  });
});
