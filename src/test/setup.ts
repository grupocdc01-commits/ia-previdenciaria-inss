import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";

// All unit/component tests stay offline. Integrations need their own authorized suite.
beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network disabled in tests"));
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
