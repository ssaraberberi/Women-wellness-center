import { SignJWT, jwtVerify } from 'jose';
import type { Role } from '@prisma/client';
import { env } from '../env.js';
import { prisma } from '../lib/prisma.js';
import { E } from '../lib/errors.js';
import { randomToken, sha256 } from '../lib/crypto.js';
import { randomUUID } from 'node:crypto';

const key = new TextEncoder().encode(env.JWT_SECRET);
const ISSUER = 'dua-api';

export interface AuthUser {
  id: string;
  role: Role;
  isOwner: boolean;
  isInstructor: boolean;
  isTherapist: boolean;
  canViewClientNotes: boolean;
}

export async function signAccessToken(userId: string, role: Role) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MIN}m`)
    .sign(key);
}

/**
 * Verify the bearer token, then read the user: a disabled account or a changed
 * role takes effect on the next request, not when the token expires.
 */
export async function authenticate(header: string | undefined): Promise<AuthUser> {
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw E.unauthorized();
  let sub: string;
  try {
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, algorithms: ['HS256'] });
    sub = String(payload.sub);
  } catch {
    throw E.unauthorized('Session expired');
  }
  const user = await prisma.user.findUnique({
    where: { id: sub },
    select: { id: true, role: true, status: true, isOwner: true, staffProfile: true },
  });
  if (!user || user.status === 'DISABLED' || user.status === 'DELETED') throw E.unauthorized();
  return {
    id: user.id,
    role: user.role,
    isOwner: user.isOwner,
    isInstructor: !!user.staffProfile?.isInstructor,
    isTherapist: !!user.staffProfile?.isTherapist,
    canViewClientNotes: user.role === 'ADMIN' || !!user.staffProfile?.canViewClientNotes,
  };
}

/** A new sign-in: a new refresh-token family. */
export async function issueSession(userId: string, role: Role, meta: { ip?: string; userAgent?: string }) {
  return createSessionRow(userId, role, randomUUID(), meta);
}

async function createSessionRow(userId: string, role: Role, familyId: string, meta: { ip?: string; userAgent?: string }) {
  const refreshToken = randomToken(48);
  await prisma.authSession.create({
    data: {
      userId,
      familyId,
      refreshTokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 300),
    },
  });
  return { accessToken: await signAccessToken(userId, role), refreshToken, expiresIn: env.ACCESS_TOKEN_TTL_MIN * 60 };
}

/**
 * Rotation: each refresh token works once. Presenting one that was already
 * rotated means it was copied — the whole family is revoked, so the thief and
 * the owner are both signed out and the owner signs in again.
 */
export async function rotateRefreshToken(refreshToken: string, meta: { ip?: string; userAgent?: string }) {
  const hash = sha256(refreshToken);
  const row = await prisma.authSession.findUnique({ where: { refreshTokenHash: hash }, include: { user: true } });
  if (!row) throw E.unauthorized();
  if (row.rotatedAt || row.revokedAt) {
    await prisma.authSession.updateMany({
      where: { familyId: row.familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw E.unauthorized('Session revoked');
  }
  if (row.expiresAt < new Date()) throw E.unauthorized('Session expired');
  if (row.user.status === 'DISABLED' || row.user.status === 'DELETED') throw E.unauthorized();

  // Claim the row atomically so two concurrent refreshes cannot both succeed.
  const claimed = await prisma.authSession.updateMany({
    where: { id: row.id, rotatedAt: null, revokedAt: null },
    data: { rotatedAt: new Date() },
  });
  if (claimed.count !== 1) throw E.unauthorized('Session revoked');
  return createSessionRow(row.userId, row.user.role, row.familyId, meta);
}

export async function revokeRefreshToken(refreshToken: string) {
  const row = await prisma.authSession.findUnique({ where: { refreshTokenHash: sha256(refreshToken) } });
  if (!row) return;
  await prisma.authSession.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeAllSessions(userId: string) {
  await prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
