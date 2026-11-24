import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { EmployeeDocumentsController } from './employee-documents.controller';
import { EmployeeDocumentsService } from './employee-documents.service';
import { ProfileService } from './profile.service';
import { MyProfileController } from './my-profile.controller';
import { BankChangesController } from './bank-changes.controller';

@Module({
  controllers: [EmployeeDocumentsController, EmployeesController, MyProfileController, BankChangesController],
  providers: [EmployeesService, EmployeeDocumentsService, ProfileService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
