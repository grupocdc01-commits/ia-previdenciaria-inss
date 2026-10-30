const rules: [RegExp, string][] = [
  [/invalid login credentials/i, "E-mail ou senha incorretos. Confira e tente de novo."],
  [/email not confirmed/i, "Seu e-mail ainda não foi confirmado. Abra o link que enviamos (veja também o spam)."],
  [/already registered|already been registered|user already exists/i, "Já existe uma conta com este e-mail. Use “Entrar” ou recupere a senha."],
  [/password should be at least|weak password|password is too weak/i, "A senha é fraca. Use pelo menos 8 caracteres, misturando letras e números."],
  [/pwned|leaked|compromised/i, "Esta senha apareceu em vazamentos conhecidos. Escolha outra senha."],
  [/rate limit|too many requests|security purposes/i, "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo."],
  [/unable to validate email|invalid email|email address .* is invalid/i, "Este e-mail parece inválido. Confira se foi digitado corretamente."],
  [/failed to fetch|network/i, "Sem conexão com o servidor. Verifique sua internet e tente de novo."],
];

export function friendlyAuthError(error: unknown, fallback = "Não foi possível entrar. Tente de novo."): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  for (const [pattern, text] of rules) if (pattern.test(raw)) return text;
  return fallback;
}
