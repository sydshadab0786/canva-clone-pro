/**
 * Idempotent seed: billing plans + a verified admin user.
 * Safe to run repeatedly (uses upserts).
 */
import {
  PrismaClient,
  BillingInterval,
  Prisma,
  ProjectType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// ── Template scene-document helpers ────────────────────────────────
// Objects mirror the editor's SceneObject shape (kept as plain JSON here so
// the API has no dependency on the web package).
let seq = 0;
const oid = (t: string) => `${t}_${(seq += 1)}`;

const base = (over: Record<string, unknown>) => ({
  rotation: 0,
  opacity: 1,
  locked: false,
  visible: true,
  groupId: null,
  ...over,
});

const rect = (o: Record<string, unknown>) => base({ type: 'rect', name: 'Rectangle', stroke: null, strokeWidth: 0, cornerRadius: 0, id: oid('rect'), ...o });
const text = (o: Record<string, unknown>) =>
  base({
    type: 'text',
    name: 'Text',
    fontFamily: 'Inter',
    fontStyle: 'normal',
    align: 'left',
    fill: '#111827',
    lineHeight: 1.2,
    letterSpacing: 0,
    id: oid('text'),
    ...o,
  });

function doc(background: string, objects: Record<string, unknown>[]) {
  return { version: 1, background, objects };
}

interface SeedTemplate {
  title: string;
  type: ProjectType;
  category: string;
  width: number;
  height: number;
  isPremium: boolean;
  tags: string[];
  document: ReturnType<typeof doc>;
}

const templates: SeedTemplate[] = [
  {
    title: 'Bold Quote — Instagram',
    type: ProjectType.INSTAGRAM_POST,
    category: 'Social Media',
    width: 1080,
    height: 1080,
    isPremium: false,
    tags: ['instagram', 'quote', 'minimal'],
    document: doc('#111827', [
      rect({ x: 80, y: 80, width: 920, height: 920, fill: '#111827', stroke: '#7c3aed', strokeWidth: 4 }),
      text({ x: 140, y: 380, width: 800, text: 'Dream big.\nStart small.\nAct now.', fontSize: 96, fontStyle: 'italic bold', fill: '#ffffff', align: 'center' }),
      text({ x: 140, y: 860, width: 800, text: '@canvaclonepro', fontSize: 32, fill: '#a78bfa', align: 'center' }),
    ]),
  },
  {
    title: 'Event Poster',
    type: ProjectType.POSTER,
    category: 'Marketing',
    width: 1080,
    height: 1620,
    isPremium: false,
    tags: ['poster', 'event', 'music'],
    document: doc('#7c3aed', [
      rect({ x: 0, y: 0, width: 1080, height: 1620, fill: '#7c3aed' }),
      rect({ x: 90, y: 90, width: 900, height: 900, fill: '#ec4899', cornerRadius: 24 }),
      text({ x: 120, y: 1080, width: 840, text: 'SUMMER\nSOUND FEST', fontSize: 120, fontStyle: 'bold', fill: '#ffffff' }),
      text({ x: 120, y: 1380, width: 840, text: 'Sat 12 July · 6PM · City Park', fontSize: 44, fill: '#fce7f3' }),
    ]),
  },
  {
    title: 'Clean Resume',
    type: ProjectType.RESUME,
    category: 'Documents',
    width: 794,
    height: 1123,
    isPremium: false,
    tags: ['resume', 'cv', 'professional'],
    document: doc('#ffffff', [
      rect({ x: 0, y: 0, width: 260, height: 1123, fill: '#111827' }),
      text({ x: 40, y: 80, width: 200, text: 'JANE\nDOE', fontSize: 44, fontStyle: 'bold', fill: '#ffffff' }),
      text({ x: 40, y: 240, width: 200, text: 'Product Designer', fontSize: 20, fill: '#a78bfa' }),
      text({ x: 300, y: 80, width: 460, text: 'Experience', fontSize: 30, fontStyle: 'bold', fill: '#111827' }),
      text({ x: 300, y: 140, width: 460, text: 'Senior Designer — Acme (2022–now)\nDesigner — Globex (2019–2022)', fontSize: 18, fill: '#374151' }),
    ]),
  },
  {
    title: 'YouTube Thumbnail',
    type: ProjectType.YOUTUBE_THUMBNAIL,
    category: 'Social Media',
    width: 1280,
    height: 720,
    isPremium: true,
    tags: ['youtube', 'thumbnail', 'gaming'],
    document: doc('#0f172a', [
      rect({ x: 0, y: 0, width: 1280, height: 720, fill: '#0f172a' }),
      rect({ x: 0, y: 520, width: 1280, height: 200, fill: '#ef4444' }),
      text({ x: 60, y: 120, width: 900, text: 'TOP 10 TIPS', fontSize: 140, fontStyle: 'bold', fill: '#facc15' }),
      text({ x: 60, y: 560, width: 900, text: 'You need to know', fontSize: 64, fontStyle: 'bold', fill: '#ffffff' }),
    ]),
  },
  {
    title: 'Business Card',
    type: ProjectType.BUSINESS_CARD,
    category: 'Branding',
    width: 1050,
    height: 600,
    isPremium: false,
    tags: ['business card', 'branding'],
    document: doc('#ffffff', [
      rect({ x: 0, y: 0, width: 1050, height: 600, fill: '#ffffff', stroke: '#e5e7eb', strokeWidth: 2 }),
      rect({ x: 0, y: 0, width: 24, height: 600, fill: '#7c3aed' }),
      text({ x: 90, y: 200, width: 700, text: 'Jane Doe', fontSize: 64, fontStyle: 'bold', fill: '#111827' }),
      text({ x: 90, y: 300, width: 700, text: 'Founder & CEO', fontSize: 28, fill: '#7c3aed' }),
      text({ x: 90, y: 400, width: 700, text: 'jane@company.com · +1 555 0100', fontSize: 24, fill: '#6b7280' }),
    ]),
  },
];

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

  // ── Templates ──────────────────────────────────────────────────
  // Idempotent by (title): only insert templates that don't already exist.
  for (const t of templates) {
    const document = t.document as unknown as Prisma.InputJsonValue;
    const existing = await prisma.template.findFirst({ where: { title: t.title } });
    if (existing) {
      await prisma.template.update({
        where: { id: existing.id },
        data: {
          category: t.category,
          tags: t.tags,
          isPremium: t.isPremium,
          document,
          width: t.width,
          height: t.height,
        },
      });
    } else {
      await prisma.template.create({ data: { ...t, document } });
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seed complete. Admin login: ${adminEmail} / Admin123!Change. Templates: ${templates.length}.`,
  );
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
