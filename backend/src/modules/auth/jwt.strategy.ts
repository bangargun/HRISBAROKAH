import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; username: string; role: string; iat?: number }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Akun tidak ditemukan atau tidak aktif');
    }
    // Token yang terbit sebelum password diganti / di-reset tidak berlaku lagi
    if (user.passwordChangedAt && (payload.iat ?? 0) < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      throw new UnauthorizedException('Password sudah diganti. Silakan masuk lagi.');
    }

    return user;
  }
}
