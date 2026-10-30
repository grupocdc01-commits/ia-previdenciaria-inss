import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LegalLibraryResults } from "@/components/legal-library";
import { readLegalLibrary } from "@/lib/legal/catalog";

afterEach(cleanup);
describe("legal library transparency", () => {
  it("shows sources and pending review without claiming legal release", () => {
    render(
      <LegalLibraryResults
        data={readLegalLibrary({ onDate: "2026-10-30", query: "sumula" }, "2026-10-30")}
      />,
    );
    expect(screen.getByText("Uso em conclusões bloqueado")).toBeInTheDocument();
    expect(screen.getByText(/Revisão jurídica humana pendente/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Consultar fonte oficial/ })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(screen.getByText(/identificação pendente/)).toBeInTheDocument();
  });
  it("handles empty results without inventing a source", () => {
    render(
      <LegalLibraryResults
        data={readLegalLibrary(
          { onDate: "2026-10-30", query: "source-does-not-exist" },
          "2026-10-30",
        )}
      />,
    );
    expect(screen.getByText(/Nenhuma referência corresponde/)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
