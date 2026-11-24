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

const GENDER_ALIASES: Record<string, string> = {
  l: 'Laki-laki',
  'laki-laki': 'Laki-laki',
  'laki laki': 'Laki-laki',
  pria: 'Laki-laki',
  p: 'Perempuan',
  perempuan: 'Perempuan',
  wanita: 'Perempuan',
};
/** Kolom profil yang bisa diperbarui lewat Excel, beserta label untuk laporan perubahan. */
const FIELD_LABELS = [
  ['fullName', 'Nama'],
  ['phone', 'No HP'],
  ['outletId', 'Cabang'],
  ['positionId', 'Jabatan'],
  ['status', 'Status kerja'],
  ['joinDate', 'Tanggal masuk'],
  ['birthDate', 'Tanggal lahir'],
  ['gender', 'Jenis kelamin'],
  ['address', 'Alamat'],
  ['bankName', 'Nama bank'],
  ['bankAccountNumber', 'Nomor rekening'],
  ['bankAccountHolder', 'Pemilik rekening'],
] as const;

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
   * Impor dari Excel. NIK adalah kunci: NIK baru = karyawan baru, NIK terdaftar = perbarui
   * (hanya sel yang diisi yang mengubah data; sel kosong tidak menghapus apa pun).
   * Semua baris diperiksa dulu; data disimpan dalam satu transaksi hanya bila tidak ada
   * baris yang salah dan dryRun = false. Password kosong untuk karyawan baru dibuat acak
   * dan dikembalikan sekali agar bisa dibagikan HR.
   */
  async importMany(actor: AuthUser, rows: ImportEmployeeRow[], dryRun: boolean) {
    const text = (v?: string) => (v ?? '').trim();
    const norm = (v?: string) => text(v).toLowerCase();
    const niks = Array.from(new Set(rows.map((r) => text(r.nik)).filter(Boolean)));
    const [outlets, positions, existingProfiles] = await Promise.all([
      this.prisma.outlet.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true } }),
      this.prisma.position.findMany({ select: { id: true, title: true } }),
      this.prisma.employeeProfile.findMany({ where: { nik: { in: niks } }, include: { user: { select: { id: true, role: true, email: true } } } }),
    ]);
    const outletOf = new Map<string, { id: string; name: string }>();
    for (const o of outlets) {
      outletOf.set(norm(o.code), o);
      outletOf.set(norm(o.name), o);
    }
    const existingOf = new Map(existingProfiles.map((e) => [e.nik, e]));
    const outletName = new Map(outlets.map((o) => [o.id, o.name]));

    const prepared = rows.map((raw, i) => {
      const errors: string[] = [];
      const nik = text(raw.nik);
      const existing = nik ? existingOf.get(nik) : undefined;

      // Kolom pilihan diperiksa sama untuk baris baru maupun perbarui
      const outlet = text(raw.outlet) ? outletOf.get(norm(raw.outlet)) : undefined;
      if (text(raw.outlet) && !outlet) errors.push(`Cabang "${raw.outlet}" tidak ditemukan (pakai kode atau nama cabang aktif)`);
      const positionMatches = text(raw.position) ? positions.filter((p) => norm(p.title) === norm(raw.position)) : [];
      if (text(raw.position) && positionMatches.length === 0) errors.push(`Jabatan "${raw.position}" tidak ditemukan`);
      if (positionMatches.length > 1) errors.push(`Jabatan "${raw.position}" ada di beberapa departemen`);
      const role = text(raw.role) ? ROLE_ALIASES[norm(raw.role)] : undefined;
      if (text(raw.role) && !role) errors.push(`Peran "${raw.role}" tidak dikenal`);
      const status = text(raw.status) ? STATUS_ALIASES[norm(raw.status)] : undefined;
      if (text(raw.status) && !status) errors.push(`Status kerja "${raw.status}" tidak dikenal`);
      const gender = text(raw.gender) ? GENDER_ALIASES[norm(raw.gender)] : undefined;
      if (text(raw.gender) && !gender) errors.push(`Jenis kelamin "${raw.gender}" tidak dikenal (Laki-laki atau Perempuan)`);
      const dateOf = (v: string | undefined, label: string) => {
        if (!text(v)) return undefined;
        try {
          return toDateOnly(parseDateParam(text(v).slice(0, 10)));
        } catch {
          errors.push(`${label} harus berformat YYYY-MM-DD`);
          return undefined;
        }
      };
      const joinDate = dateOf(raw.joinDate, 'Tanggal masuk');
      const birthDate = dateOf(raw.birthDate, 'Tanggal lahir');
      const email = text(raw.email) ? text(raw.email).toLowerCase() : undefined;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`Email "${raw.email}" tidak valid`);
      const bankAccountNumber = text(raw.bankAccountNumber).replace(/[\s.-]/g, '') || undefined;
      if (bankAccountNumber && !/^\d{5,30}$/.test(bankAccountNumber)) errors.push('Nomor rekening 5-30 digit angka');
      const lengthOk = (v: string | undefined, max: number, label: string) => {
        if (text(v).length > max) errors.push(`${label} maksimal ${max} karakter`);
      };
      lengthOk(raw.fullName, 100, 'Nama lengkap');
      lengthOk(raw.phone, 20, 'No HP');
      lengthOk(raw.address, 300, 'Alamat');
      lengthOk(raw.bankName, 60, 'Nama bank');
      lengthOk(raw.bankAccountHolder, 100, 'Nama pemilik rekening');

      const fields = {
        fullName: text(raw.fullName) || undefined,
        phone: text(raw.phone) || undefined,
        outletId: outlet?.id,
        positionId: positionMatches[0]?.id,
        status,
        joinDate,
        birthDate,
        gender,
        address: text(raw.address) || undefined,
        bankName: text(raw.bankName) || undefined,
        bankAccountNumber,
        bankAccountHolder: text(raw.bankAccountHolder) || undefined,
      };
      const base = { row: raw.excelRow ?? i + 2, nik, email, errors };

      if (!nik) errors.push('NIK wajib diisi');
      if (existing) {
        // Perbarui: hanya yang berbeda dari data sekarang
        const changes: Prisma.EmployeeProfileUncheckedUpdateInput = {};
        const changed: string[] = [];
        const sameDate = (a?: Date | null, b?: Date) => !!a && !!b && a.getTime() === b.getTime();
        for (const [key, label] of FIELD_LABELS) {
          const value = fields[key];
          if (value === undefined) continue;
          const current = existing[key];
          const same = value instanceof Date ? sameDate(current as Date | null, value) : current === value;
          if (!same) {
            (changes as Record<string, unknown>)[key] = value;
            changed.push(label);
          }
        }
        const newRole = role && role !== existing.user.role ? role : undefined;
        if (newRole) {
          if (existing.userId === actor.id) errors.push('Peran akun Anda sendiri tidak bisa diubah');
          changed.push('Peran');
        }
        const newEmail = email && email !== existing.user.email?.toLowerCase() ? email : undefined;
        if (newEmail) changed.push('Email');
        const touchesAdmin = ADMIN_ROLES.includes(existing.user.role) || (newRole && ADMIN_ROLES.includes(newRole));
        if (changed.length && touchesAdmin && actor.role !== UserRole.SUPER_ADMIN) {
          errors.push('Akun admin hanya bisa diubah Super Admin');
        }
        if (changes.outletId) changed.splice(changed.indexOf('Cabang'), 1, `Cabang → ${outletName.get(changes.outletId as string)}`);
        return {
          ...base,
          mode: 'update' as const,
          fullName: existing.fullName,
          username: '',
          existing,
          changes,
          newRole,
          newEmail,
          changed,
          dto: undefined,
          generatedPassword: undefined,
        };
      }

      // Karyawan baru: kolom wajib + aturan form tambah karyawan
      if (role && ADMIN_ROLES.includes(role) && actor.role !== UserRole.SUPER_ADMIN) {
        errors.push('Akun admin hanya bisa dibuat Super Admin');
      }
      if (!text(raw.fullName)) errors.push('Nama lengkap wajib diisi');
      if (!text(raw.phone)) errors.push('No HP wajib diisi');
      if (!text(raw.outlet)) errors.push('Cabang wajib diisi untuk karyawan baru');
      if (!text(raw.position)) errors.push('Jabatan wajib diisi untuk karyawan baru');
      if (!text(raw.joinDate)) errors.push('Tanggal masuk wajib diisi untuk karyawan baru');
      const username = (text(raw.username) || nik).toLowerCase();
      if (username && !/^[a-z0-9._-]{3,30}$/.test(username)) {
        errors.push('Username 3-30 karakter: huruf kecil, angka, titik, garis bawah atau tanda hubung');
      }
      const password = text(raw.password);
      if (password && (password.length < 6 || password.length > 72)) errors.push('Password awal 6-72 karakter');
      const generatedPassword = password ? undefined : randomPassword();
      return {
        ...base,
        mode: 'create' as const,
        fullName: fields.fullName ?? '',
        username,
        existing: undefined,
        changes: undefined,
        newRole: undefined,
        newEmail: undefined,
        changed: [] as string[],
        dto: { ...fields, nik, role: role ?? UserRole.EMPLOYEE, username, password: password || generatedPassword! },
        generatedPassword,
      };
    });

    // Ganda di dalam file
    const dupes = (label: string, valueOf: (p: (typeof prepared)[number]) => string | undefined) => {
      const seen = new Map<string, number>();
      for (const p of prepared) {
        const v = valueOf(p);
        if (!v) continue;
        if (seen.has(v)) p.errors.push(`${label} ${v} sama dengan baris ${seen.get(v)}`);
        else seen.set(v, p.row);
      }
    };
    dupes('NIK', (p) => p.nik);
    dupes('Username', (p) => (p.mode === 'create' ? p.username : undefined));
    dupes('Email', (p) => p.email);

    // Sudah dipakai akun lain di database
    const creates = prepared.filter((p) => p.mode === 'create');
    const emails = prepared.map((p) => p.email).filter((e): e is string => !!e);
    const [userTaken, emailTaken] = await Promise.all([
      this.prisma.user.findMany({ where: { username: { in: creates.map((p) => p.username).filter(Boolean) } }, select: { username: true } }),
      this.prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } }),
    ]);
    const userSet = new Set(userTaken.map((u) => u.username));
    const emailOwner = new Map(emailTaken.map((u) => [u.email!, u.id]));
    for (const p of prepared) {
      if (p.mode === 'create' && userSet.has(p.username)) p.errors.push(`Username ${p.username} sudah dipakai`);
      const owner = p.email ? emailOwner.get(p.email) : undefined;
      if (owner && owner !== p.existing?.userId) p.errors.push(`Email ${p.email} sudah dipakai akun lain`);
    }

    const invalid = prepared.filter((p) => p.errors.length).length;
    const report = prepared.map((p) => ({
      row: p.row,
      mode: p.mode,
      fullName: p.fullName,
      nik: p.nik,
      username: p.username,
      changed: p.changed,
      errors: p.errors,
    }));
    const summary = {
      created: prepared.filter((p) => p.mode === 'create').length,
      updated: prepared.filter((p) => p.mode === 'update' && p.changed.length).length,
      unchanged: prepared.filter((p) => p.mode === 'update' && !p.changed.length).length,
    };
    if (dryRun || invalid) return { saved: false, invalid, summary, rows: report };

    const hashes = await Promise.all(prepared.map((p) => (p.dto ? bcrypt.hash(p.dto.password, 10) : null)));
    await this.prisma.$transaction(
      async (tx) => {
        for (const [i, p] of prepared.entries()) {
          if (p.dto) {
            const { joinDate, birthDate, ...dto } = p.dto;
            await this.insertEmployee(tx, { ...dto, email: p.email } as CreateEmployeeDto, hashes[i]!, joinDate!, birthDate);
          } else if (p.existing && p.changed.length) {
            await this.writeUpdate(tx, p.existing, p.changes!, { role: p.newRole, email: p.newEmail });
          }
        }
      },
      { timeout: 60_000 },
    );
    return {
      saved: true,
      invalid: 0,
      summary,
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
    const email = dto.email === undefined ? undefined : dto.email?.toLowerCase() ?? null;
    if (email && email !== employee.user.email) {
      const taken = await this.prisma.user.findUnique({ where: { email } });
      if (taken) throw new ConflictException(`Email ${email} sudah dipakai akun lain`);
    }
    if (dto.outletId !== employee.outletId) await this.assertOutletAndPosition(dto.outletId, undefined);
    await this.assertOutletAndPosition(undefined, dto.positionId);
    const dateOrNull = (v: string | null | undefined) =>
      v === undefined ? undefined : v === null ? null : toDateOnly(parseDateParam(v.slice(0, 10)));

    return this.prisma.$transaction((tx) =>
      this.writeUpdate(
        tx,
        employee,
        {
          fullName: dto.fullName,
          nik: dto.nik,
          phone: dto.phone,
          outletId: dto.outletId,
          positionId: dto.positionId,
          status: dto.status,
          joinDate: dateOrNull(dto.joinDate) ?? undefined,
          birthDate: dateOrNull(dto.birthDate),
          gender: dto.gender,
          address: dto.address,
          bankName: dto.bankName,
          bankAccountNumber: dto.bankAccountNumber,
          bankAccountHolder: dto.bankAccountHolder,
        },
        { role: roleChanges ? dto.role : undefined, email: email === employee.user.email ? undefined : email },
      ),
    );
  }

  /**
   * Simpan perubahan satu karyawan (form ubah data dan impor Excel). Kepala cabang yang pindah
   * cabang atau berganti peran dilepas dari jabatan kepala cabangnya.
   */
  private async writeUpdate(
    tx: Prisma.TransactionClient,
    employee: { id: string; userId: string; outletId: string; user: { role: UserRole } },
    data: Prisma.EmployeeProfileUncheckedUpdateInput,
    account: { role?: UserRole; email?: string | null },
  ) {
    const leavesManagerPost =
      (data.outletId !== undefined && data.outletId !== employee.outletId) ||
      (account.role !== undefined && account.role !== UserRole.STORE_MANAGER);
    if (leavesManagerPost) {
      await tx.outlet.updateMany({ where: { managerId: employee.id }, data: { managerId: null } });
    }
    if (account.role !== undefined || account.email !== undefined) {
      await tx.user.update({ where: { id: employee.userId }, data: { role: account.role, email: account.email } });
    }
    return tx.employeeProfile.update({
      where: { id: employee.id },
      data,
      include: {
        user: { select: { id: true, username: true, email: true, role: true, isActive: true } },
        outlet: true,
        position: true,
      },
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

  /** HR membuat atau mengatur ulang PIN absen tablet kru (mis. kru tanpa HP). Tidak wajib diganti kru. */
  async setAttendancePin(actor: AuthUser, id: string, pin: string) {
    const employee = await this.getOrThrow(id);
    this.assertCanManageAdmin(actor, employee.user.role);
    await this.prisma.employeeProfile.update({
      where: { id },
      data: { attendancePinHash: await bcrypt.hash(pin, 10) },
    });
    return { message: `PIN absen ${employee.fullName} sudah diatur` };
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
