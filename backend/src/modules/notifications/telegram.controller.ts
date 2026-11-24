import { Body, Controller, Delete, ForbiddenException, Get, Headers, HttpCode, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { timingSafeEqual } from 'crypto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { DigestService } from './digest.service';
import { TelegramClient } from './telegram.client';

interface TelegramUpdate {
  message?: { text?: string; chat?: { id: number | string; type?: string }; from?: { username?: string } };
}

/** Webhook bot Telegram: hanya menerima permintaan yang membawa secret token webhook. */
@Controller('telegram')
export class TelegramWebhookController {
  constructor(
    private notifications: NotificationsService,
    private telegram: TelegramClient,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Headers('x-telegram-bot-api-secret-token') secret: string | undefined, @Body() update: TelegramUpdate) {
    const expected = this.telegram.webhookSecret;
    const given = Buffer.from(secret ?? '');
    if (!expected || given.length !== Buffer.byteLength(expected) || !timingSafeEqual(given, Buffer.from(expected))) {
      throw new ForbiddenException();
    }
    const msg = update?.message;
    // Hanya chat pribadi: grup tidak boleh menerima data karyawan
    if (msg?.text && msg.chat?.id !== undefined && (msg.chat.type ?? 'private') === 'private') {
      await this.notifications.handleIncoming(String(msg.chat.id), msg.text, msg.from?.username);
    }
    return { ok: true };
  }
}

/** Hubungkan / putuskan Telegram untuk akun yang login (web admin dan aplikasi kru). */
@UseGuards(JwtAuthGuard)
@Controller('me/telegram')
export class MyTelegramController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  status(@CurrentUser('id') userId: string) {
    return this.notifications.status(userId);
  }

  @Post('link')
  link(@CurrentUser('id') userId: string) {
    return this.notifications.createLink(userId);
  }

  @Delete()
  unlink(@CurrentUser('id') userId: string) {
    return this.notifications.unlink(userId);
  }
}

/** Kirim ringkasan pagi sekarang (uji / kirim ulang manual). */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('notifications')
export class NotificationsAdminController {
  constructor(private digest: DigestService) {}

  @Post('digest')
  async digestNow() {
    return { recipients: await this.digest.send() };
  }
}
