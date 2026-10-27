import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportJWK, createLocalJWKSet, SignJWT } from 'jose';
import { verifyAccessToken } from '../src/infra/auth.ts';
test('JWT valida assinatura, identidade, emissor, público e expiração', async () => {
  const pair = await generateKeyPair('RS256'); const other = await generateKeyPair('RS256');
  const keys = createLocalJWKSet({ keys: [{ ...await exportJWK(pair.publicKey), kid: 'test', alg: 'RS256' }] });
  const options = { issuer: 'https://identity.example.invalid/', audience: 'authenticated' };
  const sign = (audience = options.audience, expiration = '5m', privateKey = pair.privateKey) => new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setSubject('user-a').setIssuer(options.issuer).setAudience(audience).setIssuedAt().setExpirationTime(expiration).sign(privateKey);
  assert.equal(await verifyAccessToken(await sign(), keys, options), 'user-a');
  await assert.rejects(() => verifyAccessToken('invalid', keys, options));
  await assert.rejects(async () => verifyAccessToken(await sign('wrong'), keys, options));
  await assert.rejects(async () => verifyAccessToken(await sign(options.audience, '-1m'), keys, options));
  await assert.rejects(async () => verifyAccessToken(await sign(options.audience, '5m', other.privateKey), keys, options));
  await assert.rejects(async () => verifyAccessToken(await sign(), keys, { ...options, issuer: 'https://other.invalid/' }));
});
