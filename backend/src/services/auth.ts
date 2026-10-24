import { SignJWT, jwtVerify } from 'jose';
import { env, isProd } from '../env.js';
import { prisma, isUniqueViolation } from '../lib/prisma.js';
import { AppError, E } from '../lib/errors.js';
import { hmac, otpCode, safeEqual } from '../lib/crypto.js';
import { otpEmail, sendEmail } from './mail.js';
import { issueSession } from './tokens.js';

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

export async function verifyOtp(rawEmail: string, code: string, meta: { ip?: string; userAgent?: string }): Promise<VerifyResult> {
  const email = normalizeEmail(rawEmail);
  const challenge = await prisma.authOtpChallenge.findFirst({
    where: { email, consumedAt: null },
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
  profile: { firstName: string; lastName: string; phone: string; language: 'sq' | 'en'; marketingConsent: boolean },
  meta: { ip?: string; userAgent?: string },
) {
  let email: string;
  try {
    const { payload } = await jwtVerify(registrationToken, regKey, { algorithms: ['HS256'] });
    if (payload.purpose !== 'register' || typeof payload.email !== 'string') throw new Error();
    email = payload.email;
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
        profile: { create: { ...profile } },
        notificationPrefs: { create: { marketing: profile.marketingConsent } },
      },
    });
    return issueSession(user.id, user.role, meta);
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // Registered from another device in the meantime: the email is proven, so sign in.
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return issueSession(user.id, user.role, meta);
  }
}
