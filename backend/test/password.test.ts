import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getApp, makeUser, prisma, resetDb } from './helpers.js';
import { testOutbox } from '../src/services/mail.js';
import { normalizePhone } from '../src/lib/phone.js';

const codeFrom = (email: string) => {
  const mail = [...testOutbox].reverse().find((m) => m.to === email);
  return mail?.text.match(/\b(\d{6})\b/)?.[1];
};

describe('email + password', () => {
  beforeEach(async () => {
    await resetDb();
    testOutbox.length = 0;
  });
  afterAll(() => prisma.$disconnect());

  it('registers with a password, then signs in with it; a wrong password gets the same answer as an unknown address', async () => {
    const app = await getApp();
    const email = 'era@test.dev';
    await app.inject({ method: 'POST', url: '/auth/otp/request', payload: { email } });
    const v = await app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { email, code: codeFrom(email) } });
    const reg = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { registrationToken: v.json().registrationToken, firstName: 'Era', lastName: 'Berisha', phone: '069 123 4567', password: 'pilates2026' },
    });
    expect(reg.statusCode).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { profile: true } });
    expect(user.passwordHash).toMatch(/^scrypt\$/);
    expect(user.profile).toMatchObject({ firstName: 'Era', lastName: 'Berisha', phone: '+355691234567' });

    const ok = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'ERA@test.dev', password: 'pilates2026' } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().accessToken).toBeTruthy();

    const wrong = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password: 'nope12345' } });
    const unknown = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'ghost@test.dev', password: 'nope12345' } });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json()).toEqual(unknown.json());
    expect(wrong.json().error.code).toBe('INVALID_CREDENTIALS');
  });

  it('refuses a weak password and an invalid phone at registration', async () => {
    const app = await getApp();
    const email = 'weak@test.dev';
    await app.inject({ method: 'POST', url: '/auth/otp/request', payload: { email } });
    const v = await app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { email, code: codeFrom(email) } });
    const token = v.json().registrationToken;
    const weak = await app.inject({ method: 'POST', url: '/auth/register', payload: { registrationToken: token, firstName: 'A', phone: '+355691234567', password: 'short' } });
    expect(weak.statusCode).toBe(400);
    const badPhone = await app.inject({ method: 'POST', url: '/auth/register', payload: { registrationToken: token, firstName: 'A', phone: '+355 12', password: 'pilates2026' } });
    expect(badPhone.statusCode).toBe(400);
  });

  it('resets a forgotten password with an emailed code and ends the other sign-ins', async () => {
    const app = await getApp();
    const u = await makeUser('CLIENT');
    await prisma.authSession.create({ data: { userId: u.id, familyId: crypto.randomUUID(), refreshTokenHash: 'old', expiresAt: new Date(Date.now() + 86_400_000) } });

    const unknown = await app.inject({ method: 'POST', url: '/auth/password/forgot', payload: { email: 'ghost@test.dev' } });
    const known = await app.inject({ method: 'POST', url: '/auth/password/forgot', payload: { email: u.email } });
    expect(known.json()).toEqual(unknown.json());
    const code = codeFrom(u.email!)!;

    // A reset code does not work as a sign-in code.
    const asLogin = await app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { email: u.email, code } });
    expect(asLogin.statusCode).toBe(400);

    const r = await app.inject({ method: 'POST', url: '/auth/password/reset', payload: { email: u.email, code, password: 'newpass2026' } });
    expect(r.statusCode).toBe(200);
    expect(r.json().status).toBe('signed_in');
    const old = await prisma.authSession.findUniqueOrThrow({ where: { refreshTokenHash: 'old' } });
    expect(old.revokedAt).not.toBeNull();

    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: u.email, password: 'newpass2026' } });
    expect(login.statusCode).toBe(200);
    const reused = await app.inject({ method: 'POST', url: '/auth/password/reset', payload: { email: u.email, code, password: 'another2026' } });
    expect(reused.statusCode).toBe(400);
  });

  it('sets a first password without the old one, but changing it needs the current one', async () => {
    const app = await getApp();
    const u = await makeUser('CLIENT');
    const set = await app.inject({ method: 'POST', url: '/me/password', headers: u.auth, payload: { newPassword: 'first2026' } });
    expect(set.statusCode).toBe(200);
    const noCurrent = await app.inject({ method: 'POST', url: '/me/password', headers: u.auth, payload: { newPassword: 'second2026' } });
    expect(noCurrent.json().error.code).toBe('WRONG_PASSWORD');
    const change = await app.inject({ method: 'POST', url: '/me/password', headers: u.auth, payload: { currentPassword: 'first2026', newPassword: 'second2026' } });
    expect(change.statusCode).toBe(200);
  });

  it('checks phone numbers against each country’s numbering plan', () => {
    expect(normalizePhone('069 123 4567')).toBe('+355691234567');
    expect(normalizePhone('+39 333 123 4567')).toBe('+393331234567');
    expect(normalizePhone('+44 7911 123456')).toBe('+447911123456');
    expect(normalizePhone('+1 212 055 0123')).toBeNull(); // a US exchange cannot start with 0
    expect(normalizePhone('069 123')).toBeNull(); // too short for Albania
    expect(normalizePhone('+355 12')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
  });
});
