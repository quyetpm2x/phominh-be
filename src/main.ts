import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as Sentry from '@sentry/node';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // rawBody: true — cần cho verify chữ ký webhook (payout-webhook.controller.ts): JSON đã parse rồi
  // stringify lại KHÔNG đảm bảo giữ đúng thứ tự byte gốc mà đối tác đã ký.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  const sentryDsn = config.get<string>('SENTRY_DSN');
  if (sentryDsn) {
    Sentry.init({ dsn: sentryDsn, environment: config.get<string>('NODE_ENV', 'development') });
  }

  // whitelist: true bỏ field lạ khỏi body thay vì lỗi hoặc trả dư field không mong muốn —
  // transform: true để class-validator/class-transformer tự ép kiểu query string sang number/boolean.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  // Chỉ admin panel (apps/admin) gọi thẳng từ trình duyệt nên cần CORS — mobile app dùng
  // native fetch (không qua CORS), web marketing gọi từ Server Action (server-to-server, cũng
  // không qua CORS). Admin panel tự đính JWT vào header Authorization (không dựa vào cookie
  // trình duyệt tự gửi), nên không cần credentials: true.
  app.enableCors({ origin: config.get<string>('ADMIN_APP_URL', 'http://localhost:3001') });

  // /api/mobile/*, /api/admin/*, /api/public/* — namespace theo client, 1 backend duy nhất
  // (tai-lieu-cong-nghe-backend.md §10). Prefix đã nằm trong từng @Controller() path, không set
  // global prefix ở đây để tránh double-prefix.

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Phố Mình API')
    .setDescription('Backend Phố Mình — xem tai-lieu-cong-nghe-backend.md')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  // ConfigService.get<number>() KHÔNG tự ép kiểu — khi biến env đã set, trả về nguyên string thô
  // (chỉ trả đúng type default khi biến chưa set). Phải tự Number() mọi giá trị số đọc từ env.
  const port = Number(config.get('PORT', 3000));
  await app.listen(port);
}

bootstrap().catch((error) => {
  console.error('Không khởi động được backend:', error);
  process.exit(1);
});
