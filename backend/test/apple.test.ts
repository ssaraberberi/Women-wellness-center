import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getApp, makeUser, prisma, resetDb } from './helpers.js';
import { useAppleKeysForTests } from '../src/services/auth.js';

let sign: (claims: Record<string, unknown>, aud?: string) => Promise<string>;

describe('sign in with Apple', () => {
  beforeAll(async () => {
    // Stand-in for Apple: our own key, served as the JWKS the API checks against.
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'test', alg: 'RS256' };
    useAppleKeysForTests(createLocalJWKSet({ keys: [jwk] }));
    sign = (claims, aud = 'com.duapilatesandspa.app') =>
      new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'test' }).setIssuer('https://appleid.apple.com').setAudience(aud).setIssuedAt().setExpirationTime('5m').sign(privateKey);
  });
  beforeEach(() => resetDb());
  afterAll(() => prisma.$disconnect());

  it('registers a new Apple ID, then signs the same Apple ID straight in', async () => {
    const app = await getApp();
    const token = await sign({ sub: 'apple-001', email: 'abc@privaterelay.appleid.com', email_verified: 'true' });
    const r1 = await app.inject({ method: 'POST', url: '/auth/apple', payload: { identityToken: token } });
    expect(r1.json().status).toBe('needs_profile');
    const reg = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { registrationToken: r1.json().registrationToken, firstName: 'Era', lastName: 'B', phone: '+355691234567' },
    });
    expect(reg.statusCode).toBe(200);
    const u = await prisma.user.findUniqueOrThrow({ where: { email: 'abc@privaterelay.appleid.com' } });
    expect(u.appleSub).toBe('apple-001');
    expect(u.passwordHash).toBeNull();

    // Later sign-ins: Apple may leave the email out; the Apple ID is enough.
    const r2 = await app.inject({ method: 'POST', url: '/auth/apple', payload: { identityToken: await sign({ sub: 'apple-001' }) } });
    expect(r2.json().status).toBe('signed_in');
  });

  it('links an existing account by its Apple-verified email', async () => {
    const app = await getApp();
    const existing = await makeUser('CLIENT');
    const r = await app.inject({ method: 'POST', url: '/auth/apple', payload: { identityToken: await sign({ sub: 'apple-002', email: existing.email, email_verified: true }) } });
    expect(r.json().status).toBe('signed_in');
    expect((await prisma.user.findUniqueOrThrow({ where: { id: existing.id } })).appleSub).toBe('apple-002');
  });

  it('refuses a token for another app or not signed by Apple', async () => {
    const app = await getApp();
    const otherApp = await app.inject({ method: 'POST', url: '/auth/apple', payload: { identityToken: await sign({ sub: 'x', email: 'a@b.dev', email_verified: true }, 'com.someone.else') } });
    expect(otherApp.statusCode).toBe(401);
    const forged = await new SignJWT({ sub: 'x' }).setProtectedHeader({ alg: 'HS256' }).setIssuer('https://appleid.apple.com').setAudience('com.duapilatesandspa.app').sign(new TextEncoder().encode('x'.repeat(32)));
    const r = await app.inject({ method: 'POST', url: '/auth/apple', payload: { identityToken: forged } });
    expect(r.statusCode).toBe(401);
  });
});
