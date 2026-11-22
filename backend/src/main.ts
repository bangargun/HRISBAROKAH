import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { UPLOADS_ROOT } from './common/utils/attendance-photo.util';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Nginx berjalan di host yang sama; percaya X-Forwarded-For hanya dari loopback
  app.set('trust proxy', 'loopback');
  app.setGlobalPrefix('api/v1');
  app.enableCors();
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
