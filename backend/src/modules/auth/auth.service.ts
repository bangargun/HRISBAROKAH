import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, ChangePasswordDto } from './auth.dto';

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

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      outletId: user.profile?.outletId,
    };

    const token = this.jwtService.sign(payload);

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

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User tidak ditemukan');
    }

    const isMatch = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Password lama salah');
    }

    const hashedNew = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashedNew },
    });

    return { message: 'Password berhasil diperbarui' };
  }

  async updateFcmToken(userId: string, fcmToken: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
    });
    return { message: 'FCM Token berhasil diperbarui' };
  }
}
