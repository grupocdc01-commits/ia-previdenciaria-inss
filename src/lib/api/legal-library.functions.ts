import { createServerFn } from "@tanstack/react-start";
import { libraryQuerySchema, legalToday } from "@/lib/legal/catalog-schema";

// Public reference data only. No account, document, AI provider or database access.
export const getLegalLibrary = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => libraryQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { readLegalLibrary } = await import("@/lib/legal/catalog");
    return readLegalLibrary(data, legalToday());
  });
