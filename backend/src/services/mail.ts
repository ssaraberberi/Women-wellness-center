import { env, isProd } from '../env.js';

/**
 * Resend delivers; it does not authenticate anyone. One HTTPS call, no SDK.
 * Returns the provider id, or throws so the notification worker can retry.
 */
/** Tests read sent mail here instead of an inbox. */
export const testOutbox: { to: string; subject: string; text: string }[] = [];

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<string> {
  if (env.APP_ENV === 'test') {
    testOutbox.push({ to, subject, text });
    return 'test';
  }
  if (!env.RESEND_API_KEY) {
    if (isProd) throw new Error('RESEND_API_KEY missing');
    console.info(`[mail:dev] to=${to} subject="${subject}"\n${text}\n`);
    return 'dev-log';
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html, text }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message ?? 'unknown error'}`);
  return body.id ?? 'sent';
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The DUA letter: cream paper, wine ink, serif wordmark. Inline styles only — mail clients strip the rest. */
export function brandedEmail(opts: { heading: string; lines: string[]; code?: string; details?: [string, string][]; footer: string }) {
  const details = opts.details?.length
    ? `<table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;background:#F5ECE3;border-radius:12px">
        ${opts.details
          .map(
            ([k, v]) =>
              `<tr><td style="padding:10px 16px;color:#8A6F66;font-size:13px">${esc(k)}</td><td style="padding:10px 16px;color:#3B1522;font-size:14px;text-align:right">${esc(v)}</td></tr>`,
          )
          .join('')}
      </table>`
    : '';
  const code = opts.code
    ? `<div style="margin:24px 0;padding:18px;text-align:center;background:#F5ECE3;border-radius:12px;font-size:32px;letter-spacing:10px;color:#5E1F33;font-weight:600">${esc(opts.code)}</div>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#FBF6F0;font-family:Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" style="background:#FBF6F0;padding:32px 12px"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:520px;background:#FFFDF9;border-radius:18px;padding:36px 32px;border:1px solid #EADCCF">
      <tr><td align="center" style="font-family:Georgia,'Times New Roman',serif;font-size:34px;letter-spacing:2px;color:#5E1F33">DUA</td></tr>
      <tr><td align="center" style="font-size:10px;letter-spacing:4px;color:#8A6F66;padding-bottom:28px">PILATES &amp; SPA</td></tr>
      <tr><td style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#3B1522;padding-bottom:12px">${esc(opts.heading)}</td></tr>
      <tr><td style="font-size:15px;line-height:1.6;color:#4A3530">
        ${opts.lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join('')}
        ${code}${details}
      </td></tr>
      <tr><td style="padding-top:20px;border-top:1px solid #EADCCF;font-size:12px;color:#8A6F66;line-height:1.5">
        ${esc(opts.footer)}<br>Rruga Anton Lufi, Komuna e Parisit, Tiranë · @dua_pilates_spa
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = [
    'DUA Pilates & SPA',
    '',
    opts.heading,
    '',
    ...opts.lines,
    ...(opts.code ? ['', opts.code, ''] : []),
    ...(opts.details ?? []).map(([k, v]) => `${k}: ${v}`),
    '',
    opts.footer,
  ].join('\n');
  return { html, text };
}

export function otpEmail(code: string, lang: 'sq' | 'en', purpose: 'LOGIN' | 'REGISTER') {
  const sq = lang === 'sq';
  const subject = sq ? `${code} është kodi yt DUA` : `${code} is your DUA code`;
  const heading =
    purpose === 'REGISTER'
      ? sq
        ? 'Mirë se vjen te DUA'
        : 'Welcome to DUA'
      : sq
        ? 'Kodi yt i hyrjes'
        : 'Your sign-in code';
  const { html, text } = brandedEmail({
    heading,
    lines: [sq ? 'Fut këtë kod në aplikacion për të vazhduar. Skadon pas 10 minutash.' : 'Enter this code in the app to continue. It expires in 10 minutes.'],
    code,
    footer: sq
      ? 'Nëse nuk e kërkove ti, injoroje këtë email — askush nuk mund të hyjë pa kodin.'
      : 'If you did not ask for this, ignore this email — nobody can sign in without the code.',
  });
  return { subject, html, text };
}
