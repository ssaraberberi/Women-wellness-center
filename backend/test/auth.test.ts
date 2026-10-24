import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getApp, makeUser, prisma, resetDb } from './helpers.js';
import { testOutbox } from '../src/services/mail.js';

const codeFrom = (email: string) => {
  const mail = [...testOutbox].reverse().find((m) => m.to === email);
  return mail?.text.match(/\b(\d{6})\b/)?.[1];
};

describe('passwordless auth', () => {
  beforeEach(async () => {
    await resetDb();
    testOutbox.length = 0;
  });
  afterAll(() => prisma.$disconnect());

  it('registers a new address as a CLIENT after proving the inbox', async () => {
    const app = await getApp();
    const email = 'new.person@test.dev';
    const r1 = await app.inject({ method: 'POST', url: '/auth/otp/request', payload: { email } });
    expect(r1.statusCode).toBe(200);
    const code = codeFrom(email)!;
    expect(code).toMatch(/^\d{6}$/);
    const stored = await prisma.authOtpChallenge.findFirstOrThrow({ where: { email } });
    expect(stored.codeHash).not.toContain(code); // only a hash is stored

    const r2 = await app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { email, code } });
    expect(r2.json().status).toBe('needs_profile');
    const r3 = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { registrationToken: r2.json().registrationToken, firstName: 'Era', lastName: 'B', phone: '+355 69 111 2222', role: 'ADMIN' },
    });
    expect(r3.statusCode).toBe(200);
    const me = await app.inject({ method: 'GET', url: '/me', headers: { authorization: `Bearer ${r3.json().accessToken}` } });
    expect(me.json().role).toBe('CLIENT'); // a role in the body is ignored
  });

  it('answers the same for unknown and known addresses', async () => {
    const app = await getApp();
    const known = await makeUser('CLIENT');
    const a = await app.inject({ method: 'POST', url: '/auth/otp/request', payload: { email: known.email } });
    const b = await app.inject({ method: 'POST', url: '/auth/otp/request', payload: { email: 'nobody@test.dev' } });
    expect(a.statusCode).toBe(b.statusCode);
    expect(a.json()).toEqual(b.json());
  });

  it('locks a code after five wrong guesses, and a used code cannot be reused', async () => {
    const app = await getApp();
    const u = await makeUser('CLIENT');
    await app.inject({ method: 'POST', url: '/auth/otp/request', payload: { email: u.email } });
    const code = codeFrom(u.email)!;
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const r = await app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { email: u.email, code: wrong } });
      expect(r.json().error.code).toBe('OTP_INVALID');
    }
    const locked = await app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { email: u.email, code } });
    expect(locked.statusCode).toBe(429);

    await prisma.authOtpChallenge.deleteMany({});
    await app.inject({ method: 'POST', url: '/auth/otp/request', payload: { email: u.email } });
    const code2 = codeFrom(u.email)!;
    const ok = await app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { email: u.email, code: code2 } });
    expect(ok.json().status).toBe('signed_in');
    const again = await app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { email: u.email, code: code2 } });
    expect(again.statusCode).toBe(400);
  });

  it('rejects an expired code', async () => {
    const app = await getApp();
    const u = await makeUser('CLIENT');
    await app.inject({ method: 'POST', url: '/auth/otp/request', payload: { email: u.email } });
    await prisma.authOtpChallenge.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const r = await app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { email: u.email, code: codeFrom(u.email)! } });
    expect(r.json().error.code).toBe('OTP_EXPIRED');
  });

  it('rate-limits code requests per address', async () => {
    const app = await getApp();
    const email = 'flood@test.dev';
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await app.inject({ method: 'POST', url: '/auth/otp/request', payload: { email } })).statusCode);
    expect(codes).toEqual([200, 200, 200, 429]);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const app = await getApp();
    const u = await makeUser('CLIENT');
    await app.inject({ method: 'POST', url: '/auth/otp/request', payload: { email: u.email } });
    const s = (await app.inject({ method: 'POST', url: '/auth/otp/verify', payload: { email: u.email, code: codeFrom(u.email)! } })).json();
    const r1 = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: s.refreshToken } });
    expect(r1.statusCode).toBe(200);
    const reuse = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: s.refreshToken } });
    expect(reuse.statusCode).toBe(401);
    const r2 = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: r1.json().refreshToken } });
    expect(r2.statusCode).toBe(401);
  });

  it('a disabled account loses access immediately', async () => {
    const app = await getApp();
    const u = await makeUser('CLIENT');
    expect((await app.inject({ method: 'GET', url: '/me', headers: u.auth })).statusCode).toBe(200);
    await prisma.user.update({ where: { id: u.id }, data: { status: 'DISABLED' } });
    expect((await app.inject({ method: 'GET', url: '/me', headers: u.auth })).statusCode).toBe(401);
  });
});

describe('role-based access', () => {
  beforeEach(resetDb);

  it('keeps each role to its own endpoints', async () => {
    const app = await getApp();
    const client = await makeUser('CLIENT');
    const staff = await makeUser('STAFF', { instructor: true });
    const admin = await makeUser('ADMIN');
    expect((await app.inject({ method: 'GET', url: '/admin/dashboard', headers: client.auth })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/admin/dashboard', headers: staff.auth })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/admin/dashboard', headers: admin.auth })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/staff/today', headers: client.auth })).statusCode).toBe(403);
    expect((await app.inject({ method: 'GET', url: '/staff/today', headers: staff.auth })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/admin/dashboard' })).statusCode).toBe(401);
  });

  it('only an owner can add administrators', async () => {
    const app = await getApp();
    const admin = await makeUser('ADMIN');
    const owner = await makeUser('ADMIN', { isOwner: true });
    const payload = { email: 'new.admin@test.dev', firstName: 'New', role: 'ADMIN' };
    expect((await app.inject({ method: 'POST', url: '/admin/staff/invite', headers: admin.auth, payload })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/admin/staff/invite', headers: owner.auth, payload })).statusCode).toBe(200);
    const invited = await prisma.user.findUniqueOrThrow({ where: { email: 'new.admin@test.dev' } });
    expect(invited.role).toBe('ADMIN');
    expect(invited.status).toBe('INVITED');
    const staffInvite = await app.inject({ method: 'POST', url: '/admin/staff/invite', headers: admin.auth, payload: { email: 'coach@test.dev', firstName: 'C', role: 'STAFF', isInstructor: true } });
    expect(staffInvite.statusCode).toBe(200);
  });
});
