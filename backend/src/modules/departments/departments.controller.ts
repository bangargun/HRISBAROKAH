import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DepartmentsService } from './departments.service';
import { NameDto } from './departments.dto';

/** Departemen dan jabatan di dalamnya. Ubah hanya oleh Super Admin dan HR. */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
@Controller('departments')
export class DepartmentsController {
  constructor(private service: DepartmentsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: NameDto) {
    return this.service.createDepartment(dto.name);
  }

  @Put('positions/:positionId')
  renamePosition(@Param('positionId') id: string, @Body() dto: NameDto) {
    return this.service.renamePosition(id, dto.name);
  }

  @Delete('positions/:positionId')
  removePosition(@Param('positionId') id: string) {
    return this.service.removePosition(id);
  }

  @Put(':id')
  rename(@Param('id') id: string, @Body() dto: NameDto) {
    return this.service.renameDepartment(id, dto.name);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.removeDepartment(id);
  }

  @Post(':id/positions')
  addPosition(@Param('id') id: string, @Body() dto: NameDto) {
    return this.service.createPosition(id, dto.name);
  }
}
