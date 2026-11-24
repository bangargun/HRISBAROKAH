import { Global, Module } from '@nestjs/common';
import { TelegramClient } from './telegram.client';
import { NotificationsService } from './notifications.service';
import { DigestService } from './digest.service';
import { MyTelegramController, NotificationsAdminController, TelegramWebhookController } from './telegram.controller';

/** Global: modul pengajuan, rekening, koreksi dan tablet memanggil NotificationsService. */
@Global()
@Module({
  controllers: [TelegramWebhookController, MyTelegramController, NotificationsAdminController],
  providers: [TelegramClient, NotificationsService, DigestService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
