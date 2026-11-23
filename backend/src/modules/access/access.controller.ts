import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AccessMatrixService } from './access-matrix.service';

/** Hak akses yang berlaku (baca-saja) dan siapa saja pemegang tiap peran. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
@Controller('access')
export class AccessController {
  constructor(
    private readonly matrixService: AccessMatrixService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('matrix')
  matrix() {
    return this.matrixService.matrix();
  }

  @Get('role-holders')
  async roleHolders() {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        username: true,
        role: true,
        profile: { select: { fullName: true, outlet: { select: { name: true } }, position: { select: { title: true } } } },
      },
      orderBy: { username: 'asc' },
    });
    return Object.values(UserRole).map((role) => ({
      role,
      users: users
        .filter((u) => u.role === role)
        .map((u) => ({
          id: u.id,
          username: u.username,
          fullName: u.profile?.fullName ?? null,
          outletName: u.profile?.outlet?.name ?? null,
          positionTitle: u.profile?.position?.title ?? null,
        })),
    }));
  }
}
