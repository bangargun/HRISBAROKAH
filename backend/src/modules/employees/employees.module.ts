import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { EmployeeDocumentsController } from './employee-documents.controller';
import { EmployeeDocumentsService } from './employee-documents.service';

@Module({
  controllers: [EmployeeDocumentsController, EmployeesController],
  providers: [EmployeesService, EmployeeDocumentsService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
