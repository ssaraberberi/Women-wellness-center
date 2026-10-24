import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { route } from '../lib/http.js';
import { prisma } from '../lib/prisma.js';
import { audit } from '../lib/settings.js';
import { revokeAllSessions } from '../services/tokens.js';
import { E } from '../lib/errors.js';

export async function meRoutes(app: FastifyInstance) {
  route(app, { method: 'GET', url: '/me', access: 'user', summary: 'The signed-in user', tags: ['me'] }, async ({ user }) => {
    const u = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { profile: true, staffProfile: true, notificationPrefs: true },
    });
    return {
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      isOwner: u.isOwner,
      createdAt: u.createdAt,
      profile: u.profile,
      staff: u.staffProfile ? { isInstructor: u.staffProfile.isInstructor, isTherapist: u.staffProfile.isTherapist, canViewClientNotes: u.staffProfile.canViewClientNotes, bio: u.staffProfile.bio } : null,
      notificationPrefs: u.notificationPrefs ?? { pushEnabled: true, emailEnabled: true, reminders: true, waitlist: true, marketing: false },
    };
  });

  route(
    app,
    {
      method: 'PATCH',
      url: '/me/profile',
      access: 'user',
      summary: 'Update name, phone, language',
      tags: ['me'],
      body: z.object({
        firstName: z.string().trim().min(1).max(60).optional(),
        lastName: z.string().trim().max(60).optional(),
        phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/).optional(),
        language: z.enum(['sq', 'en']).optional(),
        marketingConsent: z.boolean().optional(),
      }),
    },
    async ({ user, body }) => {
      const profile = await prisma.userProfile.upsert({
        where: { userId: user.id },
        update: body,
        create: { userId: user.id, firstName: body.firstName ?? '', ...body },
      });
      if (body.marketingConsent !== undefined) {
        await prisma.notificationPreference.upsert({ where: { userId: user.id }, update: { marketing: body.marketingConsent }, create: { userId: user.id, marketing: body.marketingConsent } });
      }
      return profile;
    },
  );

  route(
    app,
    {
      method: 'PATCH',
      url: '/me/notification-preferences',
      access: 'user',
      summary: 'Which notifications to receive. Essential booking messages always appear in the app.',
      tags: ['me'],
      body: z.object({
        pushEnabled: z.boolean().optional(),
        emailEnabled: z.boolean().optional(),
        reminders: z.boolean().optional(),
        waitlist: z.boolean().optional(),
        marketing: z.boolean().optional(),
      }),
    },
    async ({ user, body }) => {
      const prefs = await prisma.notificationPreference.upsert({ where: { userId: user.id }, update: body, create: { userId: user.id, ...body } });
      if (body.marketing !== undefined) await prisma.userProfile.updateMany({ where: { userId: user.id }, data: { marketingConsent: body.marketing } });
      return prefs;
    },
  );

  route(
    app,
    {
      method: 'POST',
      url: '/me/push-tokens',
      access: 'user',
      summary: 'Register this device for push notifications',
      tags: ['me'],
      body: z.object({ token: z.string().regex(/^Expo(nent)?PushToken\[.+\]$/), platform: z.enum(['ios', 'android', 'web']).optional() }),
    },
    async ({ user, body }) => {
      // A device belongs to whoever signed in on it last.
      await prisma.pushToken.upsert({ where: { token: body.token }, update: { userId: user.id, platform: body.platform }, create: { userId: user.id, token: body.token, platform: body.platform } });
      return { ok: true };
    },
  );

  route(
    app,
    { method: 'DELETE', url: '/me/push-tokens', access: 'user', summary: 'Stop push to this device (on sign-out)', tags: ['me'], body: z.object({ token: z.string() }) },
    async ({ user, body }) => {
      await prisma.pushToken.deleteMany({ where: { token: body.token, userId: user.id } });
      return { ok: true };
    },
  );

  route(
    app,
    {
      method: 'GET',
      url: '/me/notifications',
      access: 'user',
      summary: 'In-app notifications, newest first',
      tags: ['me'],
      query: z.object({ limit: z.coerce.number().min(1).max(100).default(50) }),
    },
    async ({ user, query }) => {
      const [items, unread] = await Promise.all([
        prisma.notification.findMany({ where: { userId: user.id, channel: 'IN_APP' }, orderBy: { createdAt: 'desc' }, take: query.limit }),
        prisma.notification.count({ where: { userId: user.id, channel: 'IN_APP', readAt: null } }),
      ]);
      return { unread, items: items.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, data: n.data, createdAt: n.createdAt, readAt: n.readAt })) };
    },
  );

  route(
    app,
    { method: 'POST', url: '/me/notifications/read', access: 'user', summary: 'Mark notifications read (all if no ids)', tags: ['me'], body: z.object({ ids: z.array(z.uuid()).optional() }) },
    async ({ user, body }) => {
      await prisma.notification.updateMany({
        where: { userId: user.id, channel: 'IN_APP', readAt: null, ...(body.ids ? { id: { in: body.ids } } : {}) },
        data: { readAt: new Date() },
      });
      return { ok: true };
    },
  );

  route(
    app,
    {
      method: 'POST',
      url: '/me/deletion-request',
      access: 'user',
      summary: 'Ask for the account to be deleted. Signs out everywhere; the studio completes it (records of payments are kept as the law requires).',
      tags: ['me'],
      body: z.object({ reason: z.string().max(500).optional() }),
    },
    async ({ user, body, req }) => {
      if (user.role !== 'CLIENT') throw E.forbidden('Staff accounts are removed by an administrator');
      await prisma.user.update({ where: { id: user.id }, data: { status: 'DELETION_REQUESTED' } });
      await prisma.pushToken.deleteMany({ where: { userId: user.id } });
      await revokeAllSessions(user.id);
      await audit(prisma, user.id, 'account.deletion_requested', 'user', user.id, { reason: body.reason ?? null }, req.ip);
      return { ok: true };
    },
  );
}
