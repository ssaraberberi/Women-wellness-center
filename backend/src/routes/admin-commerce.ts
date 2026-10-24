import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { route, zDate, zIdParams } from '../lib/http.js';
import { prisma, transaction } from '../lib/prisma.js';
import { E } from '../lib/errors.js';
import { audit } from '../lib/settings.js';
import { studioDayRange } from '../lib/time.js';
import { personName } from '../lib/dto.js';
import { cancelOrder, completeOnlinePayment, paymentProvider, recordManualPayment, refundPayment } from '../services/orders.js';
import { bookSpa, cancelSpa, rescheduleSpa, setSpaOutcome } from '../services/spa.js';

const ADMIN = ['ADMIN'] as const;

export async function adminCommerceRoutes(app: FastifyInstance) {
  // ─────────────── products ───────────────
  const spaItem = z.object({ treatmentId: z.uuid().nullish(), category: z.string().max(30).nullish(), quantity: z.number().int().min(1).max(50) });
  const productBody = z.object({
    kind: z.enum(['SINGLE', 'PACKAGE', 'TRIAL', 'PROMO', 'DUO', 'COMBO', 'SPA']),
    name: z.string().trim().min(1).max(80),
    nameEn: z.string().trim().max(80).nullish(),
    description: z.string().max(2000).default(''),
    descriptionEn: z.string().max(2000).nullish(),
    price: z.number().int().min(0).max(10_000_000),
    originalPrice: z.number().int().min(0).max(10_000_000).nullish(),
    classCredits: z.number().int().min(0).max(500).default(0),
    validityDays: z.number().int().min(1).max(730),
    sessionsPerWeekHint: z.number().int().min(1).max(14).nullish(),
    terms: z.string().max(4000).default(''),
    termsEn: z.string().max(4000).nullish(),
    firstTimeOnly: z.boolean().default(false),
    maxPerClient: z.number().int().min(1).max(100).nullish(),
    imageKey: z.string().max(60).nullish(),
    sortOrder: z.number().int().default(0),
    active: z.boolean().default(true),
    spaItems: z.array(spaItem).max(10).default([]),
  });

  route(app, { method: 'GET', url: '/admin/products', access: [...ADMIN], summary: 'Every package, inactive included', tags: ['admin-commerce'] }, async () => {
    const rows = await prisma.membershipProduct.findMany({ include: { spaItems: { include: { treatment: true } }, _count: { select: { purchases: true } } }, orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { price: 'asc' }] });
    return rows;
  });

  route(app, { method: 'POST', url: '/admin/products', access: [...ADMIN], summary: 'Create a package', tags: ['admin-commerce'], body: productBody }, async ({ body, user }) => {
    const { spaItems, ...data } = body;
    for (const i of spaItems) if (!i.treatmentId && !i.category) throw E.badRequest('VALIDATION', 'Each SPA item needs a treatment or a category');
    if (!data.classCredits && !spaItems.length) throw E.badRequest('VALIDATION', 'A package must include classes or SPA treatments');
    const row = await prisma.membershipProduct.create({ data: { ...data, spaItems: { create: spaItems.map((i) => ({ treatmentId: i.treatmentId ?? null, category: i.category ?? null, quantity: i.quantity })) } }, include: { spaItems: true } });
    await audit(prisma, user.id, 'product.create', 'membership_product', row.id, body);
    return row;
  });

  route(
    app,
    { method: 'PATCH', url: '/admin/products/:id', access: [...ADMIN], summary: 'Edit a package. Purchases already made keep the terms they were sold with.', tags: ['admin-commerce'], params: zIdParams, body: productBody.partial() },
    async ({ params, body, user }) => {
      const { spaItems, ...data } = body;
      const row = await transaction(async (tx) => {
        if (spaItems) {
          await tx.membershipProductSpaItem.deleteMany({ where: { productId: params.id } });
          await tx.membershipProductSpaItem.createMany({ data: spaItems.map((i) => ({ productId: params.id, treatmentId: i.treatmentId ?? null, category: i.category ?? null, quantity: i.quantity })) });
        }
        const r = await tx.membershipProduct.update({ where: { id: params.id }, data, include: { spaItems: true } });
        await audit(tx, user.id, 'product.update', 'membership_product', params.id, body);
        return r;
      });
      return row;
    },
  );

  // ─────────────── orders & payments ───────────────
  route(
    app,
    { method: 'GET', url: '/admin/orders', access: [...ADMIN], summary: 'Orders, pending first', tags: ['admin-commerce'], query: z.object({ status: z.enum(['PENDING', 'PAID', 'CANCELLED', 'REFUNDED']).optional(), q: z.string().max(60).optional() }) },
    async ({ query }) => {
      const rows = await prisma.order.findMany({
        where: {
          status: query.status,
          ...(query.q ? { OR: [{ reference: { contains: query.q, mode: 'insensitive' } }, { user: { profile: { firstName: { contains: query.q, mode: 'insensitive' } } } }, { user: { email: { contains: query.q, mode: 'insensitive' } } }] } : {}),
        },
        include: { user: { include: { profile: true } }, purchase: true, payments: true, promotion: true },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 100,
      });
      return rows.map((o) => ({
        id: o.id,
        reference: o.reference,
        status: o.status,
        subtotal: o.subtotal,
        discount: o.discount,
        total: o.total,
        promotion: o.promotion?.code ?? null,
        createdAt: o.createdAt,
        client: { id: o.userId, name: personName(o.user.profile, o.user.email), phone: o.user.profile?.phone ?? null },
        product: o.purchase?.nameSnapshot ?? null,
        payments: o.payments,
      }));
    },
  );

  route(
    app,
    {
      method: 'POST',
      url: '/admin/orders/:id/payments',
      access: [...ADMIN],
      summary: 'Record a payment taken at the studio. This is the authorised manual confirmation; it activates the package.',
      tags: ['admin-commerce'],
      params: zIdParams,
      body: z.object({ method: z.enum(['CASH', 'CARD_AT_STUDIO']), amount: z.number().int().min(0).optional(), note: z.string().max(300).optional() }),
    },
    ({ params, body, user }) => recordManualPayment({ orderId: params.id, method: body.method, amount: body.amount, note: body.note, actorId: user.id }),
  );

  route(app, { method: 'POST', url: '/admin/orders/:id/cancel', access: [...ADMIN], summary: 'Cancel an unpaid order', tags: ['admin-commerce'], params: zIdParams }, ({ params, user }) =>
    cancelOrder(params.id, { id: user.id, role: 'ADMIN' }),
  );

  route(
    app,
    { method: 'GET', url: '/admin/payments', access: [...ADMIN], summary: 'Payment history', tags: ['admin-commerce'], query: z.object({ from: zDate.optional(), to: zDate.optional() }) },
    async ({ query }) => {
      const rows = await prisma.payment.findMany({
        where: query.from && query.to ? { createdAt: { gte: studioDayRange(query.from).from, lt: studioDayRange(query.to).to } } : {},
        include: { refunds: true, order: { include: { user: { include: { profile: true } }, purchase: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return rows.map((p) => ({
        id: p.id,
        method: p.method,
        status: p.status,
        amount: p.amount,
        refunded: p.refunds.reduce((s, r) => s + r.amount, 0),
        createdAt: p.createdAt,
        completedAt: p.completedAt,
        note: p.note,
        reference: p.order.reference,
        client: personName(p.order.user.profile, p.order.user.email),
        product: p.order.purchase?.nameSnapshot ?? null,
      }));
    },
  );

  route(
    app,
    { method: 'POST', url: '/admin/payments/:id/refund', access: [...ADMIN], summary: 'Refund all or part of a payment', tags: ['admin-commerce'], params: zIdParams, body: z.object({ amount: z.number().int().min(1), reason: z.string().max(300).optional(), cancelPurchase: z.boolean().default(true) }) },
    ({ params, body, user }) => refundPayment({ paymentId: params.id, amount: body.amount, reason: body.reason, actorId: user.id, cancelPurchase: body.cancelPurchase }),
  );

  // Online payments: only a configured provider with a verified signature can complete one.
  app.post('/payments/webhook/:provider', { config: { rawBody: true } }, async (req, reply) => {
    const provider = paymentProvider();
    const { provider: id } = req.params as { provider: string };
    if (!provider || provider.id !== id) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'No such payment provider' } });
    const event = await provider.verifyWebhook(JSON.stringify(req.body), req.headers);
    if (!event) return reply.code(400).send({ error: { code: 'BAD_SIGNATURE', message: 'Invalid signature' } });
    if (event.paid) await completeOnlinePayment(event.providerRef);
    return { ok: true };
  });

  // ─────────────── promotions ───────────────
  const promoBody = z.object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/),
    description: z.string().max(300).default(''),
    discountType: z.enum(['PERCENT', 'FIXED']),
    discountValue: z.number().int().min(1).max(10_000_000),
    firstTimeOnly: z.boolean().default(false),
    maxRedemptions: z.number().int().min(1).nullish(),
    validFrom: z.iso.datetime().nullish(),
    validUntil: z.iso.datetime().nullish(),
    active: z.boolean().default(true),
    productIds: z.array(z.uuid()).default([]),
  });
  route(app, { method: 'GET', url: '/admin/promotions', access: [...ADMIN], summary: 'Promotion codes with redemptions', tags: ['admin-commerce'] }, () =>
    prisma.promotionCode.findMany({ include: { products: { include: { product: { select: { id: true, name: true } } } } }, orderBy: { createdAt: 'desc' } }),
  );
  route(app, { method: 'POST', url: '/admin/promotions', access: [...ADMIN], summary: 'Create a promotion code', tags: ['admin-commerce'], body: promoBody }, async ({ body, user }) => {
    const { productIds, validFrom, validUntil, ...data } = body;
    if (data.discountType === 'PERCENT' && data.discountValue > 100) throw E.badRequest('VALIDATION', 'A percentage is at most 100');
    if (await prisma.promotionCode.findUnique({ where: { code: data.code } })) throw E.conflict('CODE_TAKEN', 'This code already exists');
    const row = await prisma.promotionCode.create({
      data: { ...data, validFrom: validFrom ? new Date(validFrom) : null, validUntil: validUntil ? new Date(validUntil) : null, products: { create: productIds.map((productId) => ({ productId })) } },
    });
    await audit(prisma, user.id, 'promotion.create', 'promotion_code', row.id, body);
    return row;
  });
  route(app, { method: 'PATCH', url: '/admin/promotions/:id', access: [...ADMIN], summary: 'Edit or deactivate a promotion code', tags: ['admin-commerce'], params: zIdParams, body: promoBody.partial() }, async ({ params, body, user }) => {
    const { productIds, validFrom, validUntil, ...data } = body;
    const row = await transaction(async (tx) => {
      if (productIds) {
        await tx.promotionProduct.deleteMany({ where: { promotionId: params.id } });
        await tx.promotionProduct.createMany({ data: productIds.map((productId) => ({ promotionId: params.id, productId })) });
      }
      return tx.promotionCode.update({
        where: { id: params.id },
        data: { ...data, validFrom: validFrom === undefined ? undefined : validFrom ? new Date(validFrom) : null, validUntil: validUntil === undefined ? undefined : validUntil ? new Date(validUntil) : null },
      });
    });
    await audit(prisma, user.id, 'promotion.update', 'promotion_code', params.id, body);
    return row;
  });

  // ─────────────── announcements ───────────────
  const annBody = z.object({
    title: z.string().min(1).max(120),
    titleEn: z.string().max(120).nullish(),
    body: z.string().min(1).max(2000),
    bodyEn: z.string().max(2000).nullish(),
    kind: z.enum(['NEWS', 'OFFER']).default('NEWS'),
    startsAt: z.iso.datetime().optional(),
    endsAt: z.iso.datetime().nullish(),
    active: z.boolean().default(true),
  });
  route(app, { method: 'GET', url: '/admin/announcements', access: [...ADMIN], summary: 'All announcements', tags: ['admin-commerce'] }, () => prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } }));
  route(app, { method: 'POST', url: '/admin/announcements', access: [...ADMIN], summary: 'Publish an announcement or offer on the home screen', tags: ['admin-commerce'], body: annBody }, async ({ body, user }) => {
    const row = await prisma.announcement.create({ data: { ...body, startsAt: body.startsAt ? new Date(body.startsAt) : undefined, endsAt: body.endsAt ? new Date(body.endsAt) : null } });
    await audit(prisma, user.id, 'announcement.create', 'announcement', row.id);
    return row;
  });
  route(app, { method: 'PATCH', url: '/admin/announcements/:id', access: [...ADMIN], summary: 'Edit an announcement', tags: ['admin-commerce'], params: zIdParams, body: annBody.partial() }, ({ params, body }) =>
    prisma.announcement.update({
      where: { id: params.id },
      data: { ...body, startsAt: body.startsAt ? new Date(body.startsAt) : undefined, endsAt: body.endsAt === undefined ? undefined : body.endsAt ? new Date(body.endsAt) : null },
    }),
  );

  // ─────────────── SPA management ───────────────
  const treatmentBody = z.object({
    name: z.string().trim().min(1).max(80),
    nameEn: z.string().trim().max(80).nullish(),
    category: z.string().trim().min(1).max(30),
    description: z.string().max(2000).default(''),
    descriptionEn: z.string().max(2000).nullish(),
    benefits: z.string().max(2000).default(''),
    benefitsEn: z.string().max(2000).nullish(),
    durationMin: z.number().int().min(10).max(300),
    bufferMin: z.number().int().min(0).max(120).default(10),
    price: z.number().int().min(0).max(10_000_000),
    imageKey: z.string().max(60).nullish(),
    clientCanChooseTherapist: z.boolean().default(true),
    active: z.boolean().default(true),
  });
  route(app, { method: 'GET', url: '/admin/spa/treatments', access: [...ADMIN], summary: 'All treatments', tags: ['admin-spa'] }, () =>
    prisma.spaTreatment.findMany({ include: { qualifications: { select: { therapistId: true } } }, orderBy: [{ active: 'desc' }, { category: 'asc' }, { name: 'asc' }] }),
  );
  route(app, { method: 'POST', url: '/admin/spa/treatments', access: [...ADMIN], summary: 'Create a treatment', tags: ['admin-spa'], body: treatmentBody }, async ({ body, user }) => {
    const row = await prisma.spaTreatment.create({ data: body });
    await audit(prisma, user.id, 'treatment.create', 'spa_treatment', row.id, body);
    return row;
  });
  route(app, { method: 'PATCH', url: '/admin/spa/treatments/:id', access: [...ADMIN], summary: 'Edit a treatment (booked appointments keep their price)', tags: ['admin-spa'], params: zIdParams, body: treatmentBody.partial() }, async ({ params, body, user }) => {
    const row = await prisma.spaTreatment.update({ where: { id: params.id }, data: body });
    await audit(prisma, user.id, 'treatment.update', 'spa_treatment', row.id, body);
    return row;
  });

  route(app, { method: 'GET', url: '/admin/spa/rooms', access: [...ADMIN], summary: 'Treatment rooms', tags: ['admin-spa'] }, () => prisma.spaRoom.findMany({ orderBy: { name: 'asc' } }));
  route(app, { method: 'POST', url: '/admin/spa/rooms', access: [...ADMIN], summary: 'Add a room', tags: ['admin-spa'], body: z.object({ name: z.string().min(1).max(40) }) }, ({ body }) => prisma.spaRoom.create({ data: body }));
  route(app, { method: 'PATCH', url: '/admin/spa/rooms/:id', access: [...ADMIN], summary: 'Rename or retire a room', tags: ['admin-spa'], params: zIdParams, body: z.object({ name: z.string().min(1).max(40).optional(), active: z.boolean().optional() }) }, ({ params, body }) =>
    prisma.spaRoom.update({ where: { id: params.id }, data: body }),
  );

  route(
    app,
    { method: 'GET', url: '/admin/spa/appointments', access: [...ADMIN], summary: 'Appointments in a range', tags: ['admin-spa'], query: z.object({ from: zDate, to: zDate, therapistId: z.uuid().optional() }) },
    async ({ query }) => {
      const rows = await prisma.spaAppointment.findMany({
        where: { startsAt: { gte: studioDayRange(query.from).from, lt: studioDayRange(query.to).to }, therapistId: query.therapistId },
        include: { treatment: true, room: true, client: { include: { profile: true } }, therapist: { include: { user: { include: { profile: true } } } } },
        orderBy: { startsAt: 'asc' },
      });
      return rows.map((a) => ({
        id: a.id,
        status: a.status,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        price: a.price,
        paidWith: a.paidWith,
        treatment: { id: a.treatmentId, name: a.treatment.name },
        room: { id: a.roomId, name: a.room.name },
        client: { id: a.clientId, name: personName(a.client.profile, a.client.email), phone: a.client.profile?.phone ?? null },
        therapist: { id: a.therapistId, name: personName(a.therapist.user.profile) },
        serviceNotes: a.serviceNotes,
      }));
    },
  );

  route(
    app,
    {
      method: 'POST',
      url: '/admin/spa/appointments',
      access: [...ADMIN],
      summary: 'Book a SPA appointment for a client',
      tags: ['admin-spa'],
      body: z.object({ clientId: z.uuid(), treatmentId: z.uuid(), startsAt: z.iso.datetime(), therapistId: z.uuid().optional(), serviceNotes: z.string().max(1000).optional() }),
    },
    ({ body, user, idempotencyKey }) =>
      bookSpa({ clientId: body.clientId, treatmentId: body.treatmentId, startsAt: new Date(body.startsAt), therapistId: body.therapistId, actor: { id: user.id, role: 'ADMIN' }, idempotencyKey, serviceNotes: body.serviceNotes }),
  );

  route(
    app,
    { method: 'POST', url: '/admin/spa/appointments/:id/reschedule', access: [...ADMIN], summary: 'Move an appointment', tags: ['admin-spa'], params: zIdParams, body: z.object({ startsAt: z.iso.datetime(), therapistId: z.uuid().optional() }) },
    ({ params, body, user }) => rescheduleSpa(params.id, new Date(body.startsAt), body.therapistId, user.id),
  );

  route(
    app,
    { method: 'POST', url: '/admin/spa/appointments/:id/cancel', access: [...ADMIN], summary: 'Cancel an appointment', tags: ['admin-spa'], params: zIdParams, body: z.object({ restoreEntitlement: z.boolean().default(true) }) },
    ({ params, body, user }) => cancelSpa(params.id, { id: user.id, role: 'ADMIN' }, body),
  );

  route(
    app,
    { method: 'POST', url: '/admin/spa/appointments/:id/outcome', access: [...ADMIN], summary: 'Mark completed or no-show', tags: ['admin-spa'], params: zIdParams, body: z.object({ status: z.enum(['COMPLETED', 'NO_SHOW']) }) },
    ({ params, body, user }) => setSpaOutcome(params.id, { id: user.id, role: 'ADMIN' }, body.status),
  );

  route(app, { method: 'GET', url: '/admin/spa/blocks', access: [...ADMIN], summary: 'Blocked SPA time', tags: ['admin-spa'] }, () =>
    prisma.spaTimeBlock.findMany({ where: { endsAt: { gt: new Date() } }, orderBy: { startsAt: 'asc' } }),
  );
  route(
    app,
    { method: 'POST', url: '/admin/spa/blocks', access: [...ADMIN], summary: 'Block time for a therapist, a room, or the whole SPA', tags: ['admin-spa'], body: z.object({ therapistId: z.uuid().nullish(), roomId: z.uuid().nullish(), startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), reason: z.string().max(200).optional() }) },
    async ({ body, user }) => {
      if (new Date(body.endsAt) <= new Date(body.startsAt)) throw E.badRequest('VALIDATION', 'The end must be after the start');
      const row = await prisma.spaTimeBlock.create({ data: { therapistId: body.therapistId ?? null, roomId: body.roomId ?? null, startsAt: new Date(body.startsAt), endsAt: new Date(body.endsAt), reason: body.reason } });
      await audit(prisma, user.id, 'spa_block.create', 'spa_time_block', row.id, body);
      return row;
    },
  );
  route(app, { method: 'DELETE', url: '/admin/spa/blocks/:id', access: [...ADMIN], summary: 'Remove a block', tags: ['admin-spa'], params: zIdParams }, async ({ params }) => {
    await prisma.spaTimeBlock.delete({ where: { id: params.id } });
    return { ok: true };
  });
}
