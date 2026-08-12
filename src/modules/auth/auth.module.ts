import { Module } from '@nestjs/common';

import { SmsOtpService } from '../../integrations/sms-otp/sms-otp.service';
import { UsersModule } from '../users/users.module';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpCleanupService } from './otp-cleanup.service';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, OtpService, TokenService, SmsOtpService, OtpCleanupService],
})
export class AuthModule {}
