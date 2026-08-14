import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { FirebaseModule } from './integrations/firebase/firebase.module';
import { SupabaseModule } from './integrations/supabase/supabase.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { TokenModule } from './modules/auth/token.module';
import { CommentsModule } from './modules/comments/comments.module';
import { EmergencyModule } from './modules/emergency/emergency.module';
import { MerchantsModule } from './modules/merchants/merchants.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PostsModule } from './modules/posts/posts.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { UsersModule } from './modules/users/users.module';
import { TrustScoreModule } from './modules/votes/trust-score.module';
import { VotesModule } from './modules/votes/votes.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        // Không log Authorization header/Service Role Key (tai-lieu-cong-nghe-backend §4.2), và
        // không log OTP/mã xác thực dạng thô nếu request/response body vô tình bị log lúc debug.
        redact: [
          'req.headers.authorization',
          'req.body.otp',
          'req.body.refreshToken',
          'res.body.accessToken',
          'res.body.refreshToken',
        ],
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }] }),
    ScheduleModule.forRoot(),
    // @Global qua JwtModule.registerAsync({ global: true }) — AdminJwtAuthGuard (dùng ở nhiều
    // module: admin, reports, moderation, payments, analytics) cần JwtService sẵn ở mọi nơi mà
    // không phải import JwtModule lặp lại từng module.
    JwtModule.registerAsync({
      global: true,
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('ADMIN_JWT_SECRET'),
        // Giây, không phải chuỗi "8h" — tránh kiểu StringValue riêng của jsonwebtoken@9 khó ép kiểu gọn.
        // Number() bắt buộc: ConfigService.get<number>() không tự ép kiểu, trả về string thô từ env
        // — nếu để nguyên string số ("28800"), jsonwebtoken hiểu nhầm thành ~1 giây thay vì 8 tiếng.
        signOptions: { expiresIn: Number(config.get('ADMIN_JWT_EXPIRES_IN_SECONDS', 28_800)) },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    SupabaseModule,
    FirebaseModule,
    TokenModule,
    TrustScoreModule,
    AuthModule,
    UsersModule,
    PostsModule,
    CommentsModule,
    VotesModule,
    ModerationModule,
    MerchantsModule,
    ReportsModule,
    EmergencyModule,
    AdminModule,
    PaymentsModule,
    RewardsModule,
    NotificationsModule,
    AnalyticsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    // ThrottlerModule.forRoot() ở trên chỉ ĐĂNG KÝ cấu hình — thiếu dòng này thì ThrottlerGuard
    // không thực sự áp dụng cho bất kỳ route nào (lỗi có sẵn trước khi thêm OTP, phát hiện lúc rà
    // soát flow gửi OTP, vá luôn vì OTP cần rate-limit hoạt động thật).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {
  constructor() {
    // Fail-fast: nếu ai copy nhầm .env dev sang production mà quên đổi SMS_OTP_MODE, OTP thật sẽ bị
    // log ra console thay vì gửi SMS thật — chặn app khởi động thay vì âm thầm chạy sai.
    if (process.env.NODE_ENV === 'production' && process.env.SMS_OTP_MODE !== 'real') {
      throw new Error(
        `SMS_OTP_MODE phải là "real" khi NODE_ENV=production — đang là "${process.env.SMS_OTP_MODE}"`,
      );
    }
  }
}
