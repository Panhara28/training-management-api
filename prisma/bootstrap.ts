// Production bootstrap — the minimum a fresh database needs, and nothing else
// (no demo trainings, participants or `password123` accounts; see seed.ts for those).
//
// Creates the permission modules, the Administrator and Trainer staff roles, and
// one administrator account. That account gets a random password that is never
// stored or shown: the administrator signs in with AAS (their @moc.gov.kh email).
//
// Usage (inside the API image):
//   BOOTSTRAP_ADMIN_EMAIL=someone@moc.gov.kh BOOTSTRAP_ADMIN_NAME="Full Name" \
//     node dist/prisma/bootstrap.js
// Idempotent: safe to run again; it never changes an existing account.
import { randomBytes } from 'crypto';
import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../src/lib/crypto';

const prisma = new PrismaClient();

const MODULES = [
  { name: 'trainings', label: 'Trainings' },
  { name: 'participants', label: 'Participants' },
  { name: 'certificates', label: 'Certificates' },
  { name: 'schedule', label: 'Schedule' },
  { name: 'reports', label: 'Reports' },
  { name: 'users', label: 'Users' },
];

const TRAINER_PERMISSIONS: Record<string, { create: boolean; read: boolean; update: boolean; delete: boolean }> = {
  trainings: { create: false, read: true, update: false, delete: false },
  schedule: { create: false, read: true, update: false, delete: false },
  participants: { create: false, read: true, update: false, delete: false },
  certificates: { create: false, read: true, update: false, delete: false },
  reports: { create: false, read: true, update: false, delete: false },
  users: { create: false, read: false, update: false, delete: false },
};

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const fullName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'System Administrator';
  if (!email || !email.endsWith('@moc.gov.kh')) {
    throw new Error('Set BOOTSTRAP_ADMIN_EMAIL to the administrator\'s @moc.gov.kh address.');
  }

  const modules = await Promise.all(
    MODULES.map((m) => prisma.permissionModule.upsert({ where: { name: m.name }, update: {}, create: m })),
  );

  const adminRole = await prisma.staffRole.upsert({
    where: { slug: 'administrator' },
    update: {},
    create: { name: 'Administrator', slug: 'administrator' },
  });
  const trainerRole = await prisma.staffRole.upsert({
    where: { slug: 'trainer' },
    update: {},
    create: { name: 'Trainer', slug: 'trainer' },
  });

  for (const m of modules) {
    const all = { create: true, read: true, update: true, delete: true };
    await prisma.staffRolePermission.upsert({
      where: { staffRoleId_moduleId: { staffRoleId: adminRole.id, moduleId: m.id } },
      update: all,
      create: { staffRoleId: adminRole.id, moduleId: m.id, ...all },
    });
    const perms = TRAINER_PERMISSIONS[m.name];
    await prisma.staffRolePermission.upsert({
      where: { staffRoleId_moduleId: { staffRoleId: trainerRole.id, moduleId: m.id } },
      update: perms,
      create: { staffRoleId: trainerRole.id, moduleId: m.id, ...perms },
    });
  }
  console.log(`permission modules: ${modules.length}, staff roles: Administrator, Trainer`);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`administrator ${email} already exists (id ${existing.id}); left unchanged`);
    return;
  }
  const admin = await prisma.user.create({
    data: {
      username: email.split('@')[0],
      email,
      fullName,
      // Unknown to anyone: this account signs in with AAS only.
      passwordHash: hashPassword(randomBytes(32).toString('hex')),
      role: Role.ADMIN,
      staffRoleId: adminRole.id,
      isActive: true,
    },
  });
  console.log(`administrator created: ${admin.email} (id ${admin.id}) — sign in with AAS`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
