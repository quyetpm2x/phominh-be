import { Module } from '@nestjs/common';

import { SmsOtpService } from '../../integrations/sms-otp/sms-otp.service';
import { UsersModule } from '../users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpCleanupService } from './otp-cleanup.service';
import { OtpService } from './otp.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  // TokenService giờ đến từ TokenModule (@Global, xem app.module.ts) — không khai báo lại ở đây.
  providers: [AuthService, OtpService, SmsOtpService, OtpCleanupService],
})
export class AuthModule {}
