/** A gentle line for the Home screen — the same one all day, a new one tomorrow. */
const lines: [string, string][] = [
  ['Lëviz me qëllim, jo me nxitim.', 'Move with intention, not hurry.'],
  ['Trupi yt është shtëpia jote. Kujdesu për të me butësi.', 'Your body is your home. Tend to it gently.'],
  ['Forca e vërtetë është e qetë.', 'True strength is quiet.'],
  ['Merr frymë thellë. Je pikërisht aty ku duhet.', 'Breathe deep. You are exactly where you need to be.'],
  ['Pak çdo ditë bëhet shumë me kohë.', 'A little every day becomes a lot in time.'],
  ['Sot, zgjidh veten.', 'Today, choose yourself.'],
  ['Qëndrueshmëria është forma më e bukur e dashurisë për veten.', 'Consistency is the loveliest form of self-love.'],
];

export function affirmation(lang: 'sq' | 'en', date = new Date()) {
  const day = Math.floor(date.getTime() / 86_400_000);
  return lines[day % lines.length][lang === 'sq' ? 0 : 1];
}
