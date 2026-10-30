import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readLegalLibrary } from "@/lib/legal/catalog";

const mocks = vi.hoisted(() => ({ library: vi.fn() }));
vi.mock("@/lib/api/cloud-adapter", () => ({ cloudAdapter: { legalLibrary: mocks.library } }));
vi.mock("@/components/investigation-shell", () => ({
  InvestigationShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
import { LegalLibraryPage } from "@/components/legal-library-page";

beforeEach(() => {
  mocks.library
    .mockReset()
    .mockImplementation(async (options: { data: unknown }) =>
      readLegalLibrary(options.data, "2026-10-30"),
    );
});
afterEach(cleanup);
function page() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <LegalLibraryPage />
    </QueryClientProvider>,
  );
}
describe("legal library page", () => {
  it("searches and paginates through the adapter with no production calls", async () => {
    page();
    await screen.findByText(/9 referências encontradas/);
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    await waitFor(() =>
      expect(mocks.library).toHaveBeenLastCalledWith({
        data: expect.objectContaining({ offset: 5, limit: 5 }),
      }),
    );
    fireEvent.change(screen.getByLabelText("Buscar norma, artigo ou precedente"), {
      target: { value: "sumula 149" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar referências" }));
    await screen.findByText(/1 referências encontradas/);
    expect(mocks.library).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ offset: 0, query: "sumula 149" }),
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("shows loading without claiming sources are approved", () => {
    mocks.library.mockImplementation(() => new Promise(() => {}));
    page();
    expect(screen.getByText("Carregando referências…")).toBeInTheDocument();
    expect(screen.queryByText(/Referência revisada/)).toBeNull();
  });
  it("fails safely on service error and permits explicit retry", async () => {
    mocks.library.mockRejectedValueOnce(new Error("synthetic internal error"));
    page();
    expect(await screen.findByRole("alert")).toHaveTextContent("Nenhuma referência foi liberada");
    expect(screen.queryByText("synthetic internal error")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText(/9 referências encontradas/);
  });
});
