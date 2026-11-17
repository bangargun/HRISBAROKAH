import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, ChangePasswordDto, ChangeUsernameDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { username, password, fcmToken } = loginDto;

    // Karyawan bisa login menggunakan username atau NIK
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { email: username },
          { profile: { nik: username } },
        ],
      },
      include: {
        profile: {
          include: {
            outlet: true,
            position: {
              include: { department: true },
            },
          },
        },
      },
    });

    // Pesan sama untuk user tidak ada dan password salah, agar username tidak bisa ditebak
    const isPasswordValid = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !isPasswordValid) {
      throw new UnauthorizedException('Username atau password salah');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Akun Anda dinonaktifkan, silakan hubungi HR');
    }

    if (fcmToken && fcmToken !== user.fcmToken) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { fcmToken },
      });
    }

    const token = this.signFor(user);

    return {
      message: 'Login berhasil',
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        profile: user.profile,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: {
          include: {
            outlet: true,
            position: {
              include: { department: true },
            },
          },
        },
      },
    });
    if (!user) return null;
    const { passwordHash, fcmToken, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Ganti password sendiri. Sesi di perangkat lain otomatis keluar; perangkat ini
   * mendapat token baru agar tetap masuk.
   */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) {
      throw new BadRequestException('User tidak ditemukan');
    }

    const isMatch = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Password lama salah');
    }
    if (dto.oldPassword === dto.newPassword) {
      throw new BadRequestException('Password baru harus berbeda dari password lama');
    }

    const hashedNew = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedNew, passwordChangedAt: new Date() },
    });

    return { message: 'Password berhasil diperbarui', accessToken: this.signFor(user) };
  }

  /** Ganti username sendiri; wajib memasukkan password saat ini. */
  async changeUsername(userId: string, dto: ChangeUsernameDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) {
      throw new BadRequestException('User tidak ditemukan');
    }
    if (!(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new BadRequestException('Password salah');
    }
    if (dto.newUsername === user.username) {
      throw new BadRequestException('Username baru sama dengan yang sekarang');
    }
    const taken = await this.prisma.user.findUnique({ where: { username: dto.newUsername } });
    if (taken) {
      throw new ConflictException(`Username ${dto.newUsername} sudah dipakai`);
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { username: dto.newUsername },
      include: { profile: true },
    });
    return {
      message: 'Username berhasil diperbarui',
      accessToken: this.signFor(updated),
      user: { id: updated.id, username: updated.username, role: updated.role, profile: updated.profile },
    };
  }

  private signFor(user: { id: string; username: string; role: string; profile?: { outletId: string } | null }) {
    return this.jwtService.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
      outletId: user.profile?.outletId,
    });
  }

  async updateFcmToken(userId: string, fcmToken: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });
    return { message: 'FCM Token berhasil diperbarui' };
  }
}
