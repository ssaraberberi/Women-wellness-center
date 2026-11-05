import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import { z } from 'zod';

/**
 * A phone number from any country, checked against that country's real
 * numbering plan (length, prefixes, mobile ranges). A number without a +
 * prefix is read as Albanian. Stored in E.164: "+355691234567".
 */
export function normalizePhone(raw: string): string | null {
  const p = parsePhoneNumberFromString(raw.trim(), 'AL');
  return p && p.isValid() ? p.number : null;
}

export const zPhone = z
  .string()
  .trim()
  .max(30)
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'INVALID_PHONE' });
      return z.NEVER;
    }
    return n;
  });
