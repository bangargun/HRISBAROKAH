import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import { UPLOADS_ROOT } from './common/utils/attendance-photo.util';
import { KIOSK_EVENTS_BODY_LIMIT } from './modules/kiosk/kiosk.dto';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Nginx berjalan di host yang sama; percaya X-Forwarded-For hanya dari loopback
  app.set('trust proxy', 'loopback');
  app.setGlobalPrefix('api/v1');
  app.enableCors();
  // Batch event tablet membawa banyak foto; parser ini dipasang lebih dulu sehingga
  // parser umum di bawah melewati body yang sudah terbaca
  app.use('/api/v1/kiosk/events', json({ limit: KIOSK_EVENTS_BODY_LIMIT }));
  // Foto selfie absensi dikirim sebagai base64 (maks 2 MB)
  app.useBodyParser('json', { limit: '4mb' });
  app.useStaticAssets(UPLOADS_ROOT, { prefix: '/uploads/' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`HRIS Backend Server running on: http://localhost:${port}/api/v1`);
}

bootstrap();
