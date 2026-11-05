import { SignJWT, createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { env, isProd } from '../env.js';
import { prisma, isUniqueViolation } from '../lib/prisma.js';
import { AppError, E } from '../lib/errors.js';
import { hmac, otpCode, safeEqual } from '../lib/crypto.js';
import { otpEmail, sendEmail } from './mail.js';
import { notifyAdmins } from './notify.js';
import { issueSession, revokeAllSessions } from './tokens.js';
import { hashPassword, verifyPassword } from '../lib/password.js';

const OTP_TTL_MS = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const PER_EMAIL_15MIN = 3;
const PER_IP_HOUR = 20;
const DEV_DOMAIN = '@dua.dev';

const regKey = new TextEncoder().encode(env.JWT_SECRET + ':registration');

export const normalizeEmail = (e: string) => e.trim().toLowerCase();
const codeHash = (email: string, code: string) => hmac(env.OTP_PEPPER, `${email}:${code}`);

const devCodeAllowed = (email: string) =>
  !isProd && env.APP_ENV !== 'production' && !!env.DEV_LOGIN_CODE && email.endsWith(DEV_DOMAIN);

/**
 * Ask for a code. The answer is the same whether or not the address has an
 * account: a new address gets a code too, and registers after proving it
 * reads that inbox. Nothing here tells a stranger who is a member.
 */
export async function requestOtp(rawEmail: string, lang: 'sq' | 'en', ip?: string) {
  const email = normalizeEmail(rawEmail);
  const since15 = new Date(Date.now() - 15 * 60_000);
  const since60 = new Date(Date.now() - 60 * 60_000);
  const [byEmail, byIp] = await Promise.all([
    prisma.authOtpChallenge.count({ where: { email, createdAt: { gte: since15 } } }),
    ip ? prisma.authOtpChallenge.count({ where: { ip, createdAt: { gte: since60 } } }) : 0,
  ]);
  if (byEmail >= PER_EMAIL_15MIN || byIp >= PER_IP_HOUR) throw E.tooMany();

  const user = await prisma.user.findUnique({ where: { email }, select: { status: true, profile: { select: { language: true } } } });
  if (user && (user.status === 'DISABLED' || user.status === 'DELETED')) {
    // Same answer, nothing sent.
    return { ok: true, expiresInSec: OTP_TTL_MS / 1000 };
  }
  const purpose = user ? 'LOGIN' : 'REGISTER';
  const code = otpCode();

  await prisma.$transaction([
    prisma.authOtpChallenge.updateMany({ where: { email, consumedAt: null }, data: { consumedAt: new Date() } }),
    prisma.authOtpChallenge.create({
      data: { email, purpose, codeHash: codeHash(email, code), expiresAt: new Date(Date.now() + OTP_TTL_MS), maxAttempts: MAX_ATTEMPTS, ip },
    }),
  ]);

  if (devCodeAllowed(email)) {
    console.info(`[auth:dev] ${email} may use DEV_LOGIN_CODE (or ${code})`);
  } else {
    const mail = otpEmail(code, user?.profile?.language ?? lang, purpose);
    try {
      await sendEmail(email, mail.subject, mail.html, mail.text);
    } catch (e) {
      console.error('[auth] OTP email failed', e);
      throw new AppError(503, 'EMAIL_FAILED', 'Could not send the email, try again');
    }
  }
  return { ok: true, expiresInSec: OTP_TTL_MS / 1000 };
}

export type VerifyResult =
  | { status: 'signed_in'; accessToken: string; refreshToken: string; expiresIn: number }
  | { status: 'needs_profile'; registrationToken: string };

/** Check and use up the newest code for this address (and purpose). Throws on a wrong, expired or exhausted code. */
async function consumeCode(email: string, code: string, purposes: ('LOGIN' | 'REGISTER' | 'RESET')[]) {
  const challenge = await prisma.authOtpChallenge.findFirst({
    where: { email, consumedAt: null, purpose: { in: purposes } },
    orderBy: { createdAt: 'desc' },
  });
  if (!challenge || challenge.expiresAt < new Date()) throw E.badRequest('OTP_EXPIRED', 'The code expired, ask for a new one');
  if (challenge.attempts >= challenge.maxAttempts) throw new AppError(429, 'OTP_LOCKED', 'Too many wrong codes, ask for a new one');

  // Count the attempt before comparing, atomically, so parallel guesses cannot exceed the limit.
  const counted = await prisma.authOtpChallenge.updateMany({
    where: { id: challenge.id, attempts: { lt: challenge.maxAttempts }, consumedAt: null },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count !== 1) throw new AppError(429, 'OTP_LOCKED', 'Too many wrong codes, ask for a new one');

  const ok =
    safeEqual(codeHash(email, code), challenge.codeHash) ||
    (devCodeAllowed(email) && safeEqual(code, env.DEV_LOGIN_CODE));
  if (!ok) {
    const left = challenge.maxAttempts - challenge.attempts - 1;
    throw E.badRequest('OTP_INVALID', 'Wrong code', { attemptsLeft: Math.max(left, 0) });
  }
  const consumed = await prisma.authOtpChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { consumedAt: new Date() } });
  if (consumed.count !== 1) throw E.badRequest('OTP_EXPIRED', 'The code was already used');
}

export async function verifyOtp(rawEmail: string, code: string, meta: { ip?: string; userAgent?: string }): Promise<VerifyResult> {
  const email = normalizeEmail(rawEmail);
  await consumeCode(email, code, ['LOGIN', 'REGISTER']);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const registrationToken = await new SignJWT({ email, purpose: 'register' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30m')
      .sign(regKey);
    return { status: 'needs_profile', registrationToken };
  }
  if (user.status === 'DISABLED' || user.status === 'DELETED') throw E.unauthorized();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
      status: user.status === 'INVITED' ? 'ACTIVE' : user.status,
    },
  });
  return { status: 'signed_in', ...(await issueSession(user.id, user.role, meta)) };
}

/** Second half of registration: the email is proven, now the person. Always a CLIENT. */
export async function completeRegistration(
  registrationToken: string,
  { password, ...profile }: { firstName: string; lastName: string; phone: string; language: 'sq' | 'en'; marketingConsent: boolean; password?: string },
  meta: { ip?: string; userAgent?: string },
) {
  const passwordHash = password ? await hashPassword(password) : undefined;
  let email: string;
  let appleSub: string | undefined;
  try {
    const { payload } = await jwtVerify(registrationToken, regKey, { algorithms: ['HS256'] });
    if (payload.purpose !== 'register' || typeof payload.email !== 'string') throw new Error();
    email = payload.email;
    if (typeof payload.appleSub === 'string') appleSub = payload.appleSub;
  } catch {
    throw E.badRequest('REGISTRATION_EXPIRED', 'Start again: the registration expired');
  }
  try {
    const user = await prisma.user.create({
      data: {
        email,
        role: 'CLIENT',
        emailVerifiedAt: new Date(),
        lastLoginAt: new Date(),
        passwordHash,
        appleSub,
        profile: { create: { ...profile } },
        notificationPrefs: { create: { marketing: profile.marketingConsent } },
      },
    });
    await notifyAdmins(prisma, {
      type: 'ADMIN_NEW_CLIENT',
      dedupeKey: `signup:${user.id}`,
      params: { client: `${profile.firstName} ${profile.lastName}`.trim(), via: appleSub ? 'Apple' : undefined },
      data: { kind: 'client', clientId: user.id },
    });
    return issueSession(user.id, user.role, meta);
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // Registered from another device in the meantime: the email is proven, so sign in.
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return issueSession(user.id, user.role, meta);
  }
}

let appleKeys: JWTVerifyGetKey = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
/** Tests sign their own "Apple" tokens. */
export const useAppleKeysForTests = (keys: JWTVerifyGetKey) => {
  appleKeys = keys;
};
// Expo Go signs Apple tokens for its own bundle id; accepted only outside production.
const appleAudiences = [...env.APPLE_AUDIENCES.split(',').map((s) => s.trim()).filter(Boolean), ...(isProd ? [] : ['host.exp.Exponent'])];

/**
 * Sign in with Apple. The identity token is checked against Apple's keys.
 * Known Apple ID → signed in. Known email (verified by Apple) → linked and
 * signed in. New → the same registration step as an emailed code, with the
 * name Apple gave prefilled; she still adds her phone.
 */
export async function signInWithApple(identityToken: string, meta: { ip?: string; userAgent?: string }): Promise<VerifyResult> {
  let sub: string;
  let email: string | undefined;
  try {
    const { payload } = await jwtVerify(identityToken, appleKeys, { issuer: 'https://appleid.apple.com', audience: appleAudiences });
    if (typeof payload.sub !== 'string') throw new Error();
    sub = payload.sub;
    const verified = payload.email_verified === true || payload.email_verified === 'true';
    if (typeof payload.email === 'string' && verified) email = normalizeEmail(payload.email);
  } catch {
    throw E.unauthorized('Apple sign-in could not be verified');
  }

  let user = await prisma.user.findUnique({ where: { appleSub: sub } });
  if (!user && email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail && !byEmail.appleSub) user = await prisma.user.update({ where: { id: byEmail.id }, data: { appleSub: sub } });
  }
  if (user) {
    if (user.status === 'DISABLED' || user.status === 'DELETED') throw E.unauthorized();
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), emailVerifiedAt: user.emailVerifiedAt ?? new Date(), status: user.status === 'INVITED' ? 'ACTIVE' : user.status },
    });
    return { status: 'signed_in', ...(await issueSession(user.id, user.role, meta)) };
  }
  if (!email) throw E.badRequest('APPLE_NO_EMAIL', 'Apple did not share an email address');
  const registrationToken = await new SignJWT({ email, appleSub: sub, purpose: 'register' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(regKey);
  return { status: 'needs_profile', registrationToken };
}

const badLogin = () => new AppError(401, 'INVALID_CREDENTIALS', 'Wrong email or password');

/**
 * Email + password. One answer for "no such account", "no password set" and
 * "wrong password", and the same work done in each case.
 */
export async function loginWithPassword(rawEmail: string, password: string, meta: { ip?: string; userAgent?: string }) {
  const email = normalizeEmail(rawEmail);
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await verifyPassword(password, user?.passwordHash);
  if (!user || !ok || user.status === 'DISABLED' || user.status === 'DELETED') throw badLogin();
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), status: user.status === 'INVITED' ? 'ACTIVE' : user.status } });
  return { status: 'signed_in' as const, ...(await issueSession(user.id, user.role, meta)) };
}

/** Email a reset code. Same answer whether or not the address has an account. */
export async function requestPasswordReset(rawEmail: string, lang: 'sq' | 'en', ip?: string) {
  const email = normalizeEmail(rawEmail);
  const since15 = new Date(Date.now() - 15 * 60_000);
  const since60 = new Date(Date.now() - 60 * 60_000);
  const [byEmail, byIp] = await Promise.all([
    prisma.authOtpChallenge.count({ where: { email, createdAt: { gte: since15 } } }),
    ip ? prisma.authOtpChallenge.count({ where: { ip, createdAt: { gte: since60 } } }) : 0,
  ]);
  if (byEmail >= PER_EMAIL_15MIN || byIp >= PER_IP_HOUR) throw E.tooMany();

  const user = await prisma.user.findUnique({ where: { email }, select: { status: true, profile: { select: { language: true } } } });
  if (!user || user.status === 'DISABLED' || user.status === 'DELETED') return { ok: true, expiresInSec: OTP_TTL_MS / 1000 };

  const code = otpCode();
  await prisma.$transaction([
    prisma.authOtpChallenge.updateMany({ where: { email, consumedAt: null, purpose: 'RESET' }, data: { consumedAt: new Date() } }),
    prisma.authOtpChallenge.create({
      data: { email, purpose: 'RESET', codeHash: codeHash(email, code), expiresAt: new Date(Date.now() + OTP_TTL_MS), maxAttempts: MAX_ATTEMPTS, ip },
    }),
  ]);
  if (devCodeAllowed(email)) {
    console.info(`[auth:dev] reset ${email} may use DEV_LOGIN_CODE (or ${code})`);
  } else {
    const mail = otpEmail(code, user.profile?.language ?? lang, 'RESET');
    try {
      await sendEmail(email, mail.subject, mail.html, mail.text);
    } catch (e) {
      console.error('[auth] reset email failed', e);
      throw new AppError(503, 'EMAIL_FAILED', 'Could not send the email, try again');
    }
  }
  return { ok: true, expiresInSec: OTP_TTL_MS / 1000 };
}

/** Set a new password with the emailed code. Every other sign-in ends; this one starts. */
export async function resetPassword(rawEmail: string, code: string, password: string, meta: { ip?: string; userAgent?: string }) {
  const email = normalizeEmail(rawEmail);
  await consumeCode(email, code, ['RESET']);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status === 'DISABLED' || user.status === 'DELETED') throw E.badRequest('OTP_EXPIRED', 'The code expired, ask for a new one');
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), emailVerifiedAt: user.emailVerifiedAt ?? new Date(), lastLoginAt: new Date(), status: user.status === 'INVITED' ? 'ACTIVE' : user.status },
  });
  await revokeAllSessions(user.id);
  return { status: 'signed_in' as const, ...(await issueSession(user.id, user.role, meta)) };
}

/** Set or change the password while signed in. Changing one needs the current one. */
export async function changePassword(userId: string, current: string | undefined, next: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.passwordHash && !(await verifyPassword(current ?? '', user.passwordHash))) {
    throw E.badRequest('WRONG_PASSWORD', 'The current password is wrong');
  }
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  return { ok: true };
}
