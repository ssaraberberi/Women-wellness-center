/**
 * Set one person's last name, found by email.
 *   EMAIL=… LAST_NAME=… npx tsx scripts/set-last-name.ts
 */
import { prisma } from '../src/lib/prisma.js';

async function main() {
  const email = process.env.EMAIL?.trim().toLowerCase();
  const lastName = process.env.LAST_NAME?.trim();
  if (!email || !lastName) throw new Error('Set EMAIL and LAST_NAME.');
  const u = await prisma.user.findUnique({ where: { email }, include: { profile: true } });
  if (!u || !u.profile) throw new Error(`No profile for ${email}`);
  console.log(`before: ${u.role} "${u.profile.firstName}" "${u.profile.lastName}"`);
  await prisma.userProfile.update({ where: { userId: u.id }, data: { lastName } });
  const after = await prisma.userProfile.findUnique({ where: { userId: u.id } });
  console.log(`after:  "${after?.firstName}" "${after?.lastName}"`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
