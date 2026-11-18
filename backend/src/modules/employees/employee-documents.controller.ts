import { Body, Controller, Delete, Get, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { EmployeeDocumentsService, MAX_DOCUMENT_BYTES, UploadedDocumentFile } from './employee-documents.service';
import { UploadDocumentDto } from './employees.dto';

// Dokumen pribadi (KTP, KK, kontrak): hanya HR dan Super Admin
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.HR_ADMIN)
@Controller('employees/:employeeId/documents')
export class EmployeeDocumentsController {
  constructor(private service: EmployeeDocumentsService) {}

  @Get()
  list(@CurrentUser() user, @Param('employeeId') employeeId: string) {
    return this.service.list(user, employeeId);
  }

  @Post()
  // Batas sedikit di atas 5 MB agar pesan "maksimal 5 MB" dari service yang tampil
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_BYTES + 1, files: 1 } }))
  upload(
    @CurrentUser() user,
    @Param('employeeId') employeeId: string,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file?: UploadedDocumentFile,
  ) {
    return this.service.upload(user, employeeId, dto.type, dto.note, file);
  }

  @Get(':documentId/file')
  async file(
    @CurrentUser() user,
    @Param('employeeId') employeeId: string,
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const { doc, data } = await this.service.file(user, employeeId, documentId);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(data);
  }

  @Delete(':documentId')
  remove(@CurrentUser() user, @Param('employeeId') employeeId: string, @Param('documentId') documentId: string) {
    return this.service.remove(user, employeeId, documentId);
  }
}
