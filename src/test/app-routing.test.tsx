import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";

// Route matching must never instantiate a real authenticated backend.
vi.mock("@/lib/api/cloud-adapter", () => ({
  cloudAdapter: { user: vi.fn().mockResolvedValue(null) },
}));

vi.hoisted(() => {
  vi.stubEnv("SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
});
import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it.each(["/questionario", "/perguntas", "/documentos", "/exemplos", "/auth"])(
    "matches %s without Supabase configuration or network calls",
    (path) => {
      const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
      const matches = router.matchRoutes(path);
      expect(matches.at(-1)?.pathname).toBe(path);
      expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it("keeps unknown paths on the not-found route", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const matches = router.matchRoutes("/does-not-exist");
    expect(matches.at(-1)?.routeId).toBe(rootRouteId);
  });
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });
});
