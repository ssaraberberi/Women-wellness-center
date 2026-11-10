import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { getApp, makeUser, prisma, resetDb } from './helpers.js';

describe('the desk makes the account, the client signs in with a DUA code', () => {
  beforeEach(() => resetDb());
  afterAll(() => prisma.$disconnect());

  it('a new client gets a DUA-… code that signs her in with her email', async () => {
    const app = await getApp();
    const admin = await makeUser('ADMIN');
    const r = await app.inject({ method: 'POST', url: '/admin/clients', headers: admin.auth, payload: { email: 'Ana@Mail.test', firstName: 'Ana', lastName: 'Hoxha', phone: '069 123 4567' } });
    expect(r.statusCode).toBe(200);
    const { password } = r.json();
    expect(password).toMatch(/^DUA-[A-HJKMNP-Z2-9]{8}$/);
    const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'ana@mail.test', password } });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toMatchObject({ status: 'signed_in' });
  });

  it('a new code replaces the old one; a client without email gets one first', async () => {
    const app = await getApp();
    const admin = await makeUser('ADMIN');
    const { id, password: old } = (await app.inject({ method: 'POST', url: '/admin/clients', headers: admin.auth, payload: { email: 'b@mail.test', firstName: 'B', phone: '069 123 4568' } })).json();
    const fresh = await app.inject({ method: 'POST', url: `/admin/clients/${id}/login-code`, headers: admin.auth });
    expect(fresh.statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'b@mail.test', password: old } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'b@mail.test', password: fresh.json().password } })).statusCode).toBe(200);

    // A client added to a class by name only gets a username with her first code.
    const noEmail = await prisma.user.create({ data: { role: 'CLIENT', profile: { create: { firstName: 'Çlirime', lastName: 'Dëshira' } } } });
    const code = (await app.inject({ method: 'POST', url: `/admin/clients/${noEmail.id}/login-code`, headers: admin.auth })).json();
    expect(code.username).toBe('clirime.deshira');
    expect((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'Clirime.Deshira', password: code.password } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PATCH', url: `/admin/clients/${noEmail.id}`, headers: admin.auth, payload: { email: 'b@mail.test' } })).statusCode).toBe(409);
  });

  it('no email needed: she signs in with the username made from her name', async () => {
    const app = await getApp();
    const admin = await makeUser('ADMIN');
    const one = (await app.inject({ method: 'POST', url: '/admin/clients', headers: admin.auth, payload: { firstName: 'Ana', lastName: 'Hoxha', phone: '069 123 4567' } })).json();
    const two = (await app.inject({ method: 'POST', url: '/admin/clients', headers: admin.auth, payload: { firstName: 'Ana', lastName: 'Hoxha', phone: '069 123 4569' } })).json();
    expect([one.username, two.username]).toEqual(['ana.hoxha', 'ana.hoxha2']);
    expect((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'ana.hoxha2', password: two.password } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'ana.hoxha', password: two.password } })).statusCode).toBe(401);
  });
});
