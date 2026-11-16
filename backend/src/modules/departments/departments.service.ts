import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.department.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        positions: {
          orderBy: { title: 'asc' },
          select: { id: true, title: true, _count: { select: { employees: true } } },
        },
      },
    });
  }

  async createDepartment(name: string) {
    await this.assertDepartmentNameFree(name);
    return this.prisma.department.create({ data: { name } });
  }

  async renameDepartment(id: string, name: string) {
    await this.getDepartment(id);
    await this.assertDepartmentNameFree(name, id);
    return this.prisma.department.update({ where: { id }, data: { name } });
  }

  async removeDepartment(id: string) {
    const dept = await this.getDepartment(id);
    const positions = await this.prisma.position.count({ where: { departmentId: id } });
    if (positions > 0) {
      throw new ConflictException(`Departemen ${dept.name} masih punya ${positions} jabatan. Hapus jabatannya dulu.`);
    }
    await this.prisma.department.delete({ where: { id } });
    return { id };
  }

  async createPosition(departmentId: string, title: string) {
    await this.getDepartment(departmentId);
    await this.assertPositionTitleFree(departmentId, title);
    return this.prisma.position.create({ data: { departmentId, title } });
  }

  async renamePosition(id: string, title: string) {
    const position = await this.getPosition(id);
    await this.assertPositionTitleFree(position.departmentId, title, id);
    return this.prisma.position.update({ where: { id }, data: { title } });
  }

  async removePosition(id: string) {
    const position = await this.getPosition(id);
    const employees = await this.prisma.employeeProfile.count({ where: { positionId: id } });
    if (employees > 0) {
      throw new ConflictException(
        `Jabatan ${position.title} masih dipakai ${employees} karyawan (termasuk yang nonaktif). Pindahkan jabatan mereka dulu.`,
      );
    }
    await this.prisma.position.delete({ where: { id } });
    return { id };
  }

  private async getDepartment(id: string) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('Departemen tidak ditemukan');
    return dept;
  }

  private async getPosition(id: string) {
    const position = await this.prisma.position.findUnique({ where: { id } });
    if (!position) throw new NotFoundException('Jabatan tidak ditemukan');
    return position;
  }

  private async assertDepartmentNameFree(name: string, exceptId?: string) {
    const taken = await this.prisma.department.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, ...(exceptId && { id: { not: exceptId } }) },
    });
    if (taken) throw new ConflictException(`Departemen ${taken.name} sudah ada`);
  }

  private async assertPositionTitleFree(departmentId: string, title: string, exceptId?: string) {
    const taken = await this.prisma.position.findFirst({
      where: {
        departmentId,
        title: { equals: title, mode: 'insensitive' },
        ...(exceptId && { id: { not: exceptId } }),
      },
    });
    if (taken) throw new ConflictException(`Jabatan ${taken.title} sudah ada di departemen ini`);
  }
}
