import { PrismaClient, UserRole, EmploymentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Mulai Seeding Data HRIS Kuliner ---');

  // 2. Departemen & Posisi
  const deptKitchen = await prisma.department.create({
    data: { name: 'Kitchen (BOH)' },
  }).catch(() => null) || (await prisma.department.findFirst({ where: { name: 'Kitchen (BOH)' } }))!;

  const deptService = await prisma.department.create({
    data: { name: 'Service (FOH)' },
  }).catch(() => null) || (await prisma.department.findFirst({ where: { name: 'Service (FOH)' } }))!;

  const posCook = await prisma.position.create({
    data: {
      title: 'Cook Station 1',
      departmentId: deptKitchen.id,
      baseSalaryMin: 4500000,
      baseSalaryMax: 6000000,
    },
  }).catch(() => null) || (await prisma.position.findFirst({ where: { title: 'Cook Station 1' } }))!;

  const posWaiter = await prisma.position.create({
    data: {
      title: 'Senior Waiter',
      departmentId: deptService.id,
      baseSalaryMin: 4200000,
      baseSalaryMax: 5000000,
    },
  }).catch(() => null) || (await prisma.position.findFirst({ where: { title: 'Senior Waiter' } }))!;

  // 4. Akun Super Admin HR (password awal dari .env, tidak pernah ditulis di kode)
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!adminPassword || adminPassword.length < 10) {
    throw new Error('Isi ADMIN_INITIAL_PASSWORD di backend/.env (minimal 10 karakter) sebelum menjalankan seed');
  }
  const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin.hr@restonusantara.com',
      passwordHash: hashedAdminPassword,
      role: UserRole.SUPER_ADMIN,
    },
  });

  console.log('Akun admin siap: username=admin (password sesuai ADMIN_INITIAL_PASSWORD). Akun yang sudah ada tidak diubah.');
  console.log('Departemen dan jabatan awal siap. Cabang dan jam kerja diisi lewat menu Cabang.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
