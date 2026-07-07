/**
 * Idempotent seed: billing plans + a verified admin user.
 * Safe to run repeatedly (uses upserts).
 */
import { PrismaClient, BillingInterval, UserRole, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const plans = [
    { code: 'free', name: 'Free', priceCents: 0, aiCredits: 20, storageMb: 1000 },
    { code: 'pro', name: 'Pro', priceCents: 1299, aiCredits: 500, storageMb: 100_000 },
    { code: 'team', name: 'Team', priceCents: 2999, aiCredits: 2000, storageMb: 1_000_000 },
  ];

  for (const p of plans) {
    await prisma.plan.upsert({
      where: { code: p.code },
      update: { name: p.name, priceCents: p.priceCents, aiCredits: p.aiCredits, storageMb: p.storageMb },
      create: { ...p, interval: BillingInterval.MONTH },
    });
  }

  const adminEmail = 'admin@canvaclone.pro';
  const passwordHash = await argon2.hash('Admin123!Change');

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      displayName: 'Platform Admin',
      username: 'admin',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seed complete. Admin login: ${adminEmail} / Admin123!Change`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
