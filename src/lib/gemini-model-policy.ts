export type GeminiModel = { name: string; supportedGenerationMethods?: string[] };
// Only models the owner confirmed on the free tier (AI Studio): 3.1 Flash Lite first, 2.5 Flash Lite fallback.
// Aliases (e.g. gemini-flash-lite-latest -> 3.5) are excluded because their free quota was not confirmed.
const ECONOMIC = ["models/gemini-3.1-flash-lite", "models/gemini-2.5-flash-lite"];
// No paid models: robust mode reuses the same free-tier list.
const ROBUST = ECONOMIC;
export function selectAvailableModel(
  models: GeminiModel[],
  mode: "economic" | "robust",
  configured?: string,
) {
  const allowed = mode === "economic" ? ECONOMIC : ROBUST;
  const candidates = configured
    ? [configured.startsWith("models/") ? configured : `models/${configured}`]
    : allowed;
  return (
    candidates.find(
      (name) =>
        allowed.includes(name) &&
        models.some(
          (model) =>
            model.name === name && model.supportedGenerationMethods?.includes("generateContent"),
        ),
    ) ?? null
  );
}
// Generation is allowed only for models whose free quota the owner confirmed in AI Studio.
export const FREE_TIER_CONFIRMED = ECONOMIC;
// Conservative global daily cap, below the smallest confirmed free RPD (2.5 Flash Lite: 20/day; 3.1: 500/day).
export const DAILY_CAP: Record<string, number> = {
  "models/gemini-3.1-flash-lite": 400,
  "models/gemini-2.5-flash-lite": 15,
};
export function freeTierAllowed(model: string) {
  return FREE_TIER_CONFIRMED.includes(model);
}
export const FREE_TIER_BLOCKED_MESSAGE =
  "Geração bloqueada: não foi possível confirmar acesso gratuito ou cota gratuita do Gemini para esta chave. Nenhuma chamada paga foi feita.";
export function sanitizeGoogleError(raw: string) {
  return raw
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[chave]")
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, "[cpf]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .slice(0, 300);
}
export function friendlyGoogleError(status: number) {
  if (status === 404)
    return "O modelo Gemini não foi encontrado para esta chave. Nenhuma conclusão foi gerada.";
  if (status === 429)
    return "Limite ou cota do Gemini atingido. Tente mais tarde; nenhuma conclusão foi gerada.";
  if (status === 403 || status === 401)
    return "A chave Gemini não tem permissão para este acesso. Confira a chave e as permissões.";
  return "Gemini indisponível no momento. Nenhuma conclusão foi gerada.";
}
