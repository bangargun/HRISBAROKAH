import { PrismaClient, UserRole, EmploymentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Mulai Seeding Data HRIS Kuliner ---');

  // 1. Outlet Restoran
  const outlet1 = await prisma.outlet.upsert({
    where: { code: 'RESTO-SENOPATI-01' },
    update: {},
    create: {
      code: 'RESTO-SENOPATI-01',
      name: 'Resto Nusantara Senopati',
      address: 'Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan',
      latitude: -6.2297,
      longitude: 106.8075,
      geofenceRadius: 60, // 60 meter
    },
  });

  const outlet2 = await prisma.outlet.upsert({
    where: { code: 'RESTO-PIK-02' },
    update: {},
    create: {
      code: 'RESTO-PIK-02',
      name: 'Resto Nusantara PIK Pantjoran',
      address: 'Pantjoran PIK, Golf Island, Jakarta Utara',
      latitude: -6.1085,
      longitude: 106.7412,
      geofenceRadius: 80,
    },
  });

  console.log('Outlet berhasil dibuat:', outlet1.name, ',', outlet2.name);

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

  // 3. Shifts
  await prisma.shift.create({
    data: {
      outletId: outlet1.id,
      name: 'Morning Shift',
      startTime: '09:00',
      endTime: '18:00',
      breakLimitMins: 60,
    },
  }).catch(() => null);

  await prisma.shift.create({
    data: {
      outletId: outlet1.id,
      name: 'Closing Shift',
      startTime: '14:00',
      endTime: '23:00',
      breakLimitMins: 60,
    },
  }).catch(() => null);

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
  console.log('Master data konfigurasi (Outlet, Departemen, Posisi, Shift) siap digunakan.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
