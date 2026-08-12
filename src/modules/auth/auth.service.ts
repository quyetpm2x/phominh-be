import { Injectable } from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';

import { OtpService } from './otp.service';
import { TokenService, type TokenPair } from './token.service';

// auth/ chỉ lo việc "xác thực xong thì làm gì tiếp" — sinh/verify OTP nằm ở OtpService, ký/xoay
// token nằm ở TokenService, tạo/lấy hồ sơ user cục bộ nằm ở UsersService (tách domain rõ ràng theo
// tai-lieu-cong-nghe-backend.md §5). Admin xác thực hoàn toàn tách biệt, xem modules/admin.
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly tokenService: TokenService,
  ) {}

  sendOtp(phone: string, captchaToken?: string) {
    return this.otpService.sendOtp(phone, captchaToken);
  }

  async verifyOtpAndLogin(
    phone: string,
    otp: string,
  ): Promise<{ tokens: TokenPair; user: unknown }> {
    const verifiedPhone = await this.otpService.verifyOtp(phone, otp);
    const user = await this.usersService.findOrCreateByPhone(verifiedPhone);
    const tokens = await this.tokenService.issueTokenPair(user.id, user.phoneNumber);
    const profile = await this.usersService.getProfile(user.id);
    return { tokens, user: profile };
  }

  refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokenService.rotateRefreshToken(refreshToken);
  }

  // Route GET /auth/me — user LUÔN đã tồn tại khi có JWT hợp lệ (được tạo lúc verify-otp), chỉ đọc
  // lại hồ sơ để client đồng bộ trạng thái, không cần provision nữa.
  me(authUser: AuthenticatedUser) {
    return this.usersService.getProfile(authUser.id);
  }
}
