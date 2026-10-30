import { createFileRoute } from "@tanstack/react-router";
import { LegalLibraryPage } from "@/components/legal-library-page";

export const Route = createFileRoute("/biblioteca")({
  head: () => ({
    meta: [
      { title: "Base jurídica e jurisprudência — IA Previdenciária INSS" },
      {
        name: "description",
        content: "Referências oficiais, versões e situação da revisão jurídica.",
      },
    ],
  }),
  component: LegalLibraryPage,
});
