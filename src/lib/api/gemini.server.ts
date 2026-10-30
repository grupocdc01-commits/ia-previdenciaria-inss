import { createServerOnlyFn } from "@tanstack/react-start";
import {
  selectAvailableModel,
  sanitizeGoogleError,
  friendlyGoogleError,
  freeTierAllowed,
  DAILY_CAP,
  FREE_TIER_BLOCKED_MESSAGE,
  type GeminiModel,
} from "@/lib/gemini-model-policy";
async function failGoogle(response: Response, op: string): Promise<never> {
  let detail = "";
  try {
    const b = (await response.json()) as { error?: { message?: string; status?: string } };
    detail = `${b.error?.status ?? ""} ${b.error?.message ?? ""}`;
  } catch {
    /* sem corpo */
  }
  console.error(`[gemini] ${op} falhou: HTTP ${response.status} ${sanitizeGoogleError(detail)}`);
  throw new Error(friendlyGoogleError(response.status));
}
export const discoverGemini = createServerOnlyFn(async (key: string, configured?: string) => {
  const models: GeminiModel[] = [];
  let token: string | undefined;
  for (let page = 0; page < 10; page++) {
    const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
    url.searchParams.set("pageSize", "100");
    if (token) url.searchParams.set("pageToken", token);
    const response = await fetch(url, {
      headers: { "x-goog-api-key": key },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) await failGoogle(response, "models.list");
    const body = (await response.json()) as { models?: GeminiModel[]; nextPageToken?: string };
    models.push(...(body.models ?? []));
    token = body.nextPageToken;
    if (!token) break;
  }
  const economic = selectAvailableModel(models, "economic", configured);
  if (!economic)
    throw new Error(
      "Nenhum modelo econômico aprovado está disponível nessa chave. A geração permanece bloqueada.",
    );
  return { economic, robust: selectAvailableModel(models, "robust") };
});
export const generateGemini = createServerOnlyFn(
  async (key: string, model: string, instruction: string, parts: unknown[], structured = false) => {
    if (!freeTierAllowed(model)) {
      console.error("[gemini] generateContent bloqueado: modelo fora da cota gratuita confirmada");
      throw new Error(FREE_TIER_BLOCKED_MESSAGE);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 864e5).toISOString();
    const { count, error } = await supabaseAdmin
      .from("private_ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("model", model)
      .gte("created_at", since);
    if (error || (count ?? 0) >= (DAILY_CAP[model] ?? 0)) {
      console.error("[gemini] limite diário conservador atingido ou não verificável");
      throw new Error(
        "Limite diário gratuito do Gemini atingido. Tente amanhã; nenhuma chamada foi feita.",
      );
    }
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${model}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instruction }] },
          contents: [{ role: "user", parts }],
          generationConfig: {
            maxOutputTokens: structured ? 4096 : 700,
            temperature: 0.1,
            ...(structured
              ? {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: "OBJECT",
                    required: ["documentType", "fields", "limitations"],
                    properties: {
                      documentType: {
                        type: "STRING",
                        enum: ["cnis", "ctps", "indeferimento", "outro", "medico"],
                      },
                      fields: {
                        type: "ARRAY",
                        items: {
                          type: "OBJECT",
                          required: ["field", "value", "page", "quote"],
                          properties: {
                            field: {
                              type: "STRING",
                              enum: [
                                "empregador",
                                "inicio_vinculo",
                                "fim_vinculo",
                                "competencia",
                                "indicador_cnis",
                                "data_decisao",
                                "motivo_administrativo",
                              ],
                            },
                            value: { type: "STRING" },
                            page: { type: "INTEGER" },
                            quote: { type: "STRING" },
                          },
                        },
                      },
                      limitations: { type: "ARRAY", items: { type: "STRING" } },
                    },
                  },
                }
              : {}),
          },
        }),
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!response.ok) await failGoogle(response, "generateContent");
    const result = (await response.json()) as {
      candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: Record<string, number>;
    };
    const candidate = result.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (!text || candidate?.finishReason !== "STOP")
      throw new Error("Gemini não concluiu a resposta com segurança.");
    return { text, usage: result.usageMetadata ?? {} };
  },
);
