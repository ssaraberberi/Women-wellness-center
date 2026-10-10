/* ============================================================
   DUA — the two emails this app sends
   ------------------------------------------------------------
   Resend over plain fetch: one HTTP call, no dependency added, and
   nothing to keep up to date. Both letters are written in Albanian and
   English, and the one that goes out is the language she was using.

   Sending can fail — a key not set, Resend down, a domain not verified
   yet. Every caller is told, and no caller treats it as fatal: the
   token is already in the database, so a studio can read a link out
   loud if it has to.
   ============================================================ */

const ENDPOINT = 'https://api.resend.com/emails';

export const mailConfigured = () => !!process.env.RESEND_API_KEY;

/* "DUA Pilates and Spa <no-reply@mail.dua-pilates.com>" by default: a
   subdomain, because Resend asks for one and because a studio's own
   address should not carry the reputation of its robots. */
const FROM = () => process.env.MAIL_FROM || 'DUA Pilates and Spa <no-reply@mail.dua-pilates.com>';
const SITE = () => (process.env.SITE_URL || 'https://dua-pilates.com').replace(/\/+$/, '');

async function send({ to, subject, html, text }) {
  if (!mailConfigured()) throw new Error('RESEND_API_KEY is not set');
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + process.env.RESEND_API_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ from: FROM(), to: [to], subject, html, text })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error('Resend answered ' + res.status + ' ' + body.slice(0, 200));
  }
  return res.json();
}

/* ---------- the letters ----------
   Plain, narrow, and readable with images and styles stripped, because
   that is how half of them will arrive. The link is also written out as
   text: a button nobody can click is not a way back in. */
const LETTERS = {
  reset: {
    sq: {
      subject: 'Rivendos fjalëkalimin — DUA',
      hello: 'Përshëndetje',
      title: 'Rivendos fjalëkalimin',
      body: 'Dikush kërkoi një fjalëkalim të ri për llogarinë tënde te DUA. Nëse ishe ti, shtyp butonin më poshtë.',
      action: 'Vendos fjalëkalim të ri',
      note: 'Linku vlen një orë dhe përdoret vetëm një herë. Nëse nuk e kërkove ti, mos bëj asgjë — fjalëkalimi yt mbetet si është.'
    },
    en: {
      subject: 'Reset your password — DUA',
      hello: 'Hello',
      title: 'Reset your password',
      body: 'Someone asked for a new password for your DUA account. If that was you, use the button below.',
      action: 'Set a new password',
      note: 'The link is good for one hour and works once. If this was not you, do nothing — your password stays as it is.'
    }
  },
  verify: {
    sq: {
      subject: 'Konfirmo email-in — DUA',
      hello: 'Përshëndetje',
      title: 'Mirë se erdhe në DUA',
      body: 'Konfirmo që kjo adresë është e jotja. Kjo na lejon të të dërgojmë një link rikthimi nëse ndonjëherë harron fjalëkalimin.',
      action: 'Konfirmo adresën',
      note: 'Linku vlen njëzet e katër orë. Llogaria jote punon edhe pa këtë — konfirmimi vetëm siguron rrugën e kthimit.'
    },
    en: {
      subject: 'Confirm your email — DUA',
      hello: 'Hello',
      title: 'Welcome to DUA',
      body: 'Confirm this address is yours. It is what lets us send you a way back in if you ever forget your password.',
      action: 'Confirm the address',
      note: 'The link is good for twenty-four hours. Your account works without this — confirming only secures the way back.'
    }
  }
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function render(copy, name, url) {
  const hello = name ? copy.hello + ' ' + name + ',' : '';
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#F5E9DC">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5E9DC;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFDF6;border-radius:14px;padding:36px 32px;font-family:Helvetica,Arial,sans-serif;color:#3B1522">
  <tr><td style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#7D2F49;padding-bottom:18px">DUA Pilates and Spa</td></tr>
  <tr><td style="font-size:24px;line-height:1.25;padding-bottom:16px">${esc(copy.title)}</td></tr>
  ${hello ? `<tr><td style="font-size:15px;line-height:1.7;padding-bottom:8px">${esc(hello)}</td></tr>` : ''}
  <tr><td style="font-size:15px;line-height:1.7;color:#6E4351;padding-bottom:26px">${esc(copy.body)}</td></tr>
  <tr><td style="padding-bottom:26px">
    <a href="${esc(url)}" style="display:inline-block;background:#7D2F49;color:#FFFBEA;text-decoration:none;padding:14px 26px;border-radius:999px;font-size:14px;letter-spacing:.08em">${esc(copy.action)}</a>
  </td></tr>
  <tr><td style="font-size:13px;line-height:1.7;color:#6E4351;padding-bottom:18px;word-break:break-all">${esc(url)}</td></tr>
  <tr><td style="font-size:13px;line-height:1.7;color:#6E4351;border-top:1px solid rgba(59,21,34,.14);padding-top:18px">${esc(copy.note)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [hello, copy.body, '', url, '', copy.note].filter(Boolean).join('\n');
  return { html, text };
}

export function sendAuthEmail({ kind, to, name, token, lang }) {
  const copy = (LETTERS[kind] || LETTERS.reset)[lang === 'en' ? 'en' : 'sq'];
  const path = kind === 'verify' ? '/app?verify=' : '/app?reset=';
  const url = SITE() + path + encodeURIComponent(token);
  const { html, text } = render(copy, name, url);
  return send({ to, subject: copy.subject, html, text });
}
