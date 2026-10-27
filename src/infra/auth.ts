import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';

export async function verifyAccessToken(token: string, keys: JWTVerifyGetKey, options: { issuer: string; audience: string }) {
  const { payload } = await jwtVerify(token, keys, { issuer: options.issuer, audience: options.audience, algorithms: ['RS256', 'ES256'], requiredClaims: ['sub', 'exp', 'iat'] });
  if (!payload.sub || payload.sub.length > 200) throw new Error('Identidade inválida.');
  return payload.sub;
}

export function jwtAuthenticator(options: { issuer: string; audience: string; jwksUrl: string }) {
  const url = new URL(options.jwksUrl);
  if (url.protocol !== 'https:') throw new Error('JWKS exige HTTPS.');
  const keys = createRemoteJWKSet(url, { timeoutDuration: 5000, cooldownDuration: 30_000 });
  return async (token: string): Promise<string> => {
    return verifyAccessToken(token, keys, options);
  };
}
