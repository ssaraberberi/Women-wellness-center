import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js/max';

/**
 * Phone numbers from any country, checked against that country's numbering
 * plan — the same rule the API applies. A number without "+" is Albanian.
 */
export function checkPhone(raw: string): { e164: string; pretty: string; country: CountryCode | undefined } | null {
  const p = parsePhoneNumberFromString(raw.trim(), 'AL');
  if (!p || !p.isValid()) return null;
  return { e164: p.number, pretty: p.formatInternational(), country: p.country };
}

/** "AL" → 🇦🇱 */
export const flag = (cc?: string) => (cc ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌍');
