import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEmployeeDto, ImportEmployeeRow, UpdateEmployeeDto } from './employees.dto';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EmploymentStatus, Prisma, UserRole } from '@prisma/client';
import { AuthUser, assertOutletAccess, scopedOutletId } from '../../common/utils/outlet-scope.util';
import { parseDateParam, toDateOnly } from '../../common/utils/business-date.util';

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.HR_ADMIN, UserRole.FINANCE_ADMIN];

// Isian Excel boleh memakai label Indonesia atau kode sistem
const ROLE_ALIASES: Record<string, UserRole> = {
  kru: UserRole.EMPLOYEE,
  employee: UserRole.EMPLOYEE,
  'kepala cabang': UserRole.STORE_MANAGER,
  store_manager: UserRole.STORE_MANAGER,
  'area manager': UserRole.AREA_MANAGER,
  area_manager: UserRole.AREA_MANAGER,
  'admin hr': UserRole.HR_ADMIN,
  hr_admin: UserRole.HR_ADMIN,
  'admin keuangan': UserRole.FINANCE_ADMIN,
  finance_admin: UserRole.FINANCE_ADMIN,
  'super admin': UserRole.SUPER_ADMIN,
  super_admin: UserRole.SUPER_ADMIN,
};
const STATUS_ALIASES: Record<string, EmploymentStatus> = {
  'masa percobaan': EmploymentStatus.PROBATION,
  probation: EmploymentStatus.PROBATION,
  kontrak: EmploymentStatus.CONTRACT,
  contract: EmploymentStatus.CONTRACT,
  tetap: EmploymentStatus.PERMANENT,
  permanent: EmploymentStatus.PERMANENT,
  harian: EmploymentStatus.DAILY_WORKER,
  daily_worker: EmploymentStatus.DAILY_WORKER,
  magang: EmploymentStatus.INTERN,
  intern: EmploymentStatus.INTERN,
};

/** Password awal acak 10 karakter tanpa huruf yang mirip (0/O, 1/l). */
function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 10 }, () => chars[randomInt(chars.length)]).join('');
}

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async findAll(actor: AuthUser, outletId?: string, departmentId?: string) {
    outletId = scopedOutletId(actor, outletId);
    return this.prisma.employeeProfile.findMany({
      where: {
        ...(outletId && { outletId }),
        ...(departmentId && { position: { departmentId } }),
      },
      include: {
        user: { select: { id: true, username: true, email: true, role: true, isActive: true } },
        outlet: { select: { id: true, code: true, name: true } },
        position: {
          select: {
            id: true,
            title: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async findOne(actor: AuthUser, id: string) {
    const employee = await this.getOrThrow(id);
    assertOutletAccess(actor, employee.outletId, 'Anda hanya bisa melihat karyawan di outlet Anda');
    return employee;
  }

  private async getOrThrow(id: string) {
    const employee = await this.prisma.employeeProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true, email: true, role: true, isActive: true } },
        outlet: true,
        position: { include: { department: true } },
        sanctions: { orderBy: { incidentDate: 'desc' }, take: 5 },
        discResults: { orderBy: { testedAt: 'desc' }, take: 1 },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Karyawan dengan ID ${id} tidak ditemukan`);
    }
    return employee;
  }

  async create(actor: AuthUser, dto: CreateEmployeeDto) {
    // Akun admin (HR, Keuangan, Super Admin) hanya boleh dibuat Super Admin
    const role = dto.role ?? UserRole.EMPLOYEE;
    if (ADMIN_ROLES.includes(role) && actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Hanya Super Admin yang bisa membuat akun admin');
    }

    // Cek username atau email atau NIK
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: dto.username },
          ...(dto.email ? [{ email: dto.email }] : []),
        ],
      },
    });
    if (existingUser) {
      throw new ConflictException('Username atau email sudah digunakan');
    }

    const existingNik = await this.prisma.employeeProfile.findUnique({
      where: { nik: dto.nik },
    });
    if (existingNik) {
      throw new ConflictException(`NIK ${dto.nik} sudah terdaftar`);
    }

    await this.assertOutletAndPosition(dto.outletId, dto.positionId);
    const joinDate = toDateOnly(parseDateParam(dto.joinDate.slice(0, 10)));
    const birthDate = dto.birthDate ? toDateOnly(parseDateParam(dto.birthDate.slice(0, 10))) : undefined;

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    return this.prisma.$transaction((tx) => this.insertEmployee(tx, dto, hashedPassword, joinDate, birthDate));
  }

  /** Simpan akun + profil karyawan (dipakai tambah satu per satu dan impor Excel). */
  private async insertEmployee(
    tx: Prisma.TransactionClient,
    dto: CreateEmployeeDto,
    passwordHash: string,
    joinDate: Date,
    birthDate?: Date,
  ) {
    const user = await tx.user.create({
      data: { username: dto.username, email: dto.email, passwordHash, role: dto.role || UserRole.EMPLOYEE },
    });
    return tx.employeeProfile.create({
      data: {
        userId: user.id,
        nik: dto.nik,
        fullName: dto.fullName,
        phone: dto.phone,
        outletId: dto.outletId,
        positionId: dto.positionId,
        status: dto.status,
        joinDate,
        birthDate,
        gender: dto.gender,
        address: dto.address,
        bankName: dto.bankName,
        bankAccountNumber: dto.bankAccountNumber,
        bankAccountHolder: dto.bankAccountHolder,
      },
      include: {
        user: { select: { id: true, username: true, role: true } },
        outlet: true,
        position: true,
      },
    });
  }

  /**
   * Impor banyak karyawan dari Excel. Semua baris diperiksa dulu; data baru disimpan
   * (dalam satu transaksi) hanya bila tidak ada baris yang salah dan dryRun = false.
   * Password kosong dibuat acak dan dikembalikan sekali agar bisa dibagikan HR.
   */
  async importMany(actor: AuthUser, rows: ImportEmployeeRow[], dryRun: boolean) {
    const [outlets, positions] = await Promise.all([
      this.prisma.outlet.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true } }),
      this.prisma.position.findMany({ select: { id: true, title: true, department: { select: { name: true } } } }),
    ]);
    const norm = (v?: string) => (v ?? '').trim().toLowerCase();
    const outletOf = new Map<string, string>();
    for (const o of outlets) {
      outletOf.set(norm(o.code), o.id);
      outletOf.set(norm(o.name), o.id);
    }

    const prepared = rows.map((raw, i) => {
      const errors: string[] = [];
      const outletId = outletOf.get(norm(raw.outlet));
      if (!outletId) errors.push(`Cabang "${raw.outlet ?? ''}" tidak ditemukan (pakai kode atau nama cabang aktif)`);
      const matches = positions.filter((p) => norm(p.title) === norm(raw.position));
      if (matches.length === 0) errors.push(`Jabatan "${raw.position ?? ''}" tidak ditemukan`);
      if (matches.length > 1) errors.push(`Jabatan "${raw.position}" ada di beberapa departemen`);
      const role = raw.role ? ROLE_ALIASES[norm(raw.role)] : UserRole.EMPLOYEE;
      if (!role) errors.push(`Peran "${raw.role}" tidak dikenal`);
      const status = raw.status ? STATUS_ALIASES[norm(raw.status)] : undefined;
      if (raw.status && !status) errors.push(`Status kerja "${raw.status}" tidak dikenal`);
      if (role && ADMIN_ROLES.includes(role) && actor.role !== UserRole.SUPER_ADMIN) {
        errors.push('Akun admin hanya bisa dibuat Super Admin');
      }
      const generatedPassword = raw.password?.trim() ? undefined : randomPassword();
      const dto = plainToInstance(CreateEmployeeDto, {
        fullName: raw.fullName,
        nik: raw.nik,
        phone: raw.phone,
        outletId: outletId ?? '00000000-0000-4000-8000-000000000000',
        positionId: matches[0]?.id ?? '00000000-0000-4000-8000-000000000000',
        joinDate: raw.joinDate,
        role: role ?? UserRole.EMPLOYEE,
        status,
        username: raw.username?.trim() ? raw.username : raw.nik,
        password: raw.password?.trim() ? raw.password : generatedPassword,
      });
      return { row: raw.excelRow ?? i + 2, raw, dto, errors, generatedPassword };
    });

    for (const p of prepared) {
      const issues = await validate(p.dto);
      for (const issue of issues) {
        // Cabang/jabatan sudah dilaporkan dengan pesan yang lebih jelas di atas
        if (issue.property === 'outletId' || issue.property === 'positionId') continue;
        p.errors.push(...Object.values(issue.constraints ?? {}));
      }
      if (!p.errors.length) {
        try {
          parseDateParam(p.dto.joinDate.slice(0, 10));
        } catch {
          p.errors.push('Tanggal masuk tidak valid');
        }
      }
    }

    // Ganda di dalam file dan di database
    const dupes = (key: 'nik' | 'username') => {
      const seen = new Map<string, number>();
      for (const p of prepared) {
        const v = p.dto[key];
        if (!v) continue;
        if (seen.has(v)) p.errors.push(`${key === 'nik' ? 'NIK' : 'Username'} ${v} sama dengan baris ${seen.get(v)}`);
        else seen.set(v, p.row);
      }
    };
    dupes('nik');
    dupes('username');
    const [nikTaken, userTaken] = await Promise.all([
      this.prisma.employeeProfile.findMany({ where: { nik: { in: prepared.map((p) => p.dto.nik).filter(Boolean) } }, select: { nik: true } }),
      this.prisma.user.findMany({ where: { username: { in: prepared.map((p) => p.dto.username).filter(Boolean) } }, select: { username: true } }),
    ]);
    const nikSet = new Set(nikTaken.map((n) => n.nik));
    const userSet = new Set(userTaken.map((u) => u.username));
    for (const p of prepared) {
      if (nikSet.has(p.dto.nik)) p.errors.push(`NIK ${p.dto.nik} sudah terdaftar`);
      if (userSet.has(p.dto.username)) p.errors.push(`Username ${p.dto.username} sudah dipakai`);
    }

    const invalid = prepared.filter((p) => p.errors.length).length;
    const report = prepared.map((p) => ({
      row: p.row,
      fullName: p.dto.fullName ?? '',
      nik: p.dto.nik ?? '',
      username: p.dto.username ?? '',
      errors: p.errors,
    }));
    if (dryRun || invalid) return { saved: false, invalid, rows: report };

    const hashes = await Promise.all(prepared.map((p) => bcrypt.hash(p.dto.password, 10)));
    await this.prisma.$transaction(
      async (tx) => {
        for (const [i, p] of prepared.entries()) {
          const joinDate = toDateOnly(parseDateParam(p.dto.joinDate.slice(0, 10)));
          await this.insertEmployee(tx, p.dto, hashes[i], joinDate);
        }
      },
      { timeout: 60_000 },
    );
    return {
      saved: true,
      invalid: 0,
      rows: report.map((r, i) => ({ ...r, generatedPassword: prepared[i].generatedPassword ?? null })),
    };
  }

  async update(actor: AuthUser, id: string, dto: UpdateEmployeeDto) {
    const employee = await this.getOrThrow(id);
    const roleChanges = dto.role !== undefined && dto.role !== employee.user.role;
    if (roleChanges) {
      if (employee.userId === actor.id) {
        throw new ForbiddenException('Anda tidak bisa mengubah peran akun Anda sendiri');
      }
      this.assertCanManageAdmin(actor, employee.user.role, dto.role);
    } else {
      this.assertCanManageAdmin(actor, employee.user.role);
    }

    if (dto.nik && dto.nik !== employee.nik) {
      const taken = await this.prisma.employeeProfile.findUnique({ where: { nik: dto.nik } });
      if (taken) throw new ConflictException(`NIK ${dto.nik} sudah terdaftar`);
    }
    if (dto.outletId !== employee.outletId) await this.assertOutletAndPosition(dto.outletId, undefined);
    await this.assertOutletAndPosition(undefined, dto.positionId);

    // Kepala cabang yang pindah cabang atau berganti peran dilepas dari jabatan kepala cabangnya
    const leavesManagerPost =
      (dto.outletId !== undefined && dto.outletId !== employee.outletId) ||
      (roleChanges && dto.role !== UserRole.STORE_MANAGER);

    return this.prisma.$transaction(async (tx) => {
      if (leavesManagerPost) {
        await tx.outlet.updateMany({ where: { managerId: id }, data: { managerId: null } });
      }
      if (roleChanges) {
        await tx.user.update({ where: { id: employee.userId }, data: { role: dto.role } });
      }
      return tx.employeeProfile.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          nik: dto.nik,
          phone: dto.phone,
          outletId: dto.outletId,
          positionId: dto.positionId,
          status: dto.status,
          joinDate: dto.joinDate ? toDateOnly(parseDateParam(dto.joinDate.slice(0, 10))) : undefined,
          bankName: dto.bankName,
          bankAccountNumber: dto.bankAccountNumber,
          bankAccountHolder: dto.bankAccountHolder,
        },
        include: {
          user: { select: { id: true, username: true, role: true, isActive: true } },
          outlet: true,
          position: true,
        },
      });
    });
  }

  /** Aktifkan atau nonaktifkan akun. Akun nonaktif tidak bisa login dan tidak masuk hitungan gaji. */
  async setActive(actor: AuthUser, id: string, isActive: boolean) {
    const employee = await this.getOrThrow(id);
    if (employee.userId === actor.id) {
      throw new ForbiddenException('Anda tidak bisa menonaktifkan akun Anda sendiri');
    }
    this.assertCanManageAdmin(actor, employee.user.role);
    if (employee.user.isActive !== isActive) {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({ where: { id: employee.userId }, data: { isActive } });
        if (!isActive) await tx.outlet.updateMany({ where: { managerId: id }, data: { managerId: null } });
        // Dipekerjakan kembali: tanggal keluar lama tidak berlaku lagi (gaji kembali dihitung penuh)
        if (isActive) await tx.employeeProfile.update({ where: { id }, data: { endDate: null } });
      });
    }
    return {
      message: `${employee.fullName} sekarang ${isActive ? 'aktif' : 'nonaktif'}`,
      isActive,
    };
  }

  async resetPassword(actor: AuthUser, id: string, newPassword: string) {
    const employee = await this.getOrThrow(id);
    if (employee.userId === actor.id) {
      throw new BadRequestException('Untuk akun Anda sendiri, gunakan menu Akun saya → Ganti password');
    }
    this.assertCanManageAdmin(actor, employee.user.role);
    await this.prisma.user.update({
      where: { id: employee.userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10), passwordChangedAt: new Date() },
    });
    return { message: `Password ${employee.fullName} sudah di-reset` };
  }

  /** Akun admin (HR, Keuangan, Super Admin) hanya boleh diubah oleh Super Admin. */
  private assertCanManageAdmin(actor: AuthUser, ...roles: (UserRole | undefined)[]) {
    if (actor.role !== UserRole.SUPER_ADMIN && roles.some((r) => r && ADMIN_ROLES.includes(r))) {
      throw new ForbiddenException('Hanya Super Admin yang bisa mengubah akun admin');
    }
  }

  /** Daftar jabatan untuk pilihan di form karyawan. */
  async listPositions() {
    return this.prisma.position.findMany({
      select: { id: true, title: true, department: { select: { id: true, name: true } } },
      orderBy: [{ department: { name: 'asc' } }, { title: 'asc' }],
    });
  }

  private async assertOutletAndPosition(outletId?: string, positionId?: string) {
    if (outletId) {
      const outlet = await this.prisma.outlet.findUnique({ where: { id: outletId } });
      if (!outlet) throw new BadRequestException('Cabang tidak ditemukan');
      if (!outlet.isActive) throw new BadRequestException(`Cabang ${outlet.name} sudah nonaktif`);
    }
    if (positionId && !(await this.prisma.position.findUnique({ where: { id: positionId } }))) {
      throw new BadRequestException('Jabatan tidak ditemukan');
    }
  }
}
