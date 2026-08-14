import { ForbiddenException, Injectable } from '@nestjs/common';

import type { AuthenticatedUser } from '../../common/guards/jwt-auth.guard';
import { AccountLifecycleService } from '../users/account-lifecycle.service';
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
    private readonly accountLifecycle: AccountLifecycleService,
  ) {}

  sendOtp(phone: string, captchaToken?: string) {
    return this.otpService.sendOtp(phone, captchaToken);
  }

  async verifyOtpAndLogin(
    phone: string,
    otp: string,
  ): Promise<{ tokens: TokenPair; user: unknown; restored: boolean }> {
    const verifiedPhone = await this.otpService.verifyOtp(phone, otp);
    const user = await this.usersService.findOrCreateByPhone(verifiedPhone);

    // Khoá tài khoản (tai-lieu-chuc-nang.md #74) — chặn đăng nhập, kèm lý do để client hiện luôn ở
    // màn OTP thay vì phải đăng nhập thành công rồi mới biết bị khoá.
    const { status, reason } = await this.accountLifecycle.getAccountStatus(user.id);
    if (status === 'banned') {
      throw new ForbiddenException(
        reason ? `Tài khoản đã bị khoá: ${reason}` : 'Tài khoản đã bị khoá',
      );
    }

    // Đang chờ xoá (tai-lieu-chuc-nang.md #69/#73) — đăng nhập lại trong 30 ngày = khôi phục.
    const restored = await this.accountLifecycle.restoreIfPendingDeletion(user.id);

    const tokens = await this.tokenService.issueTokenPair(user.id, user.phoneNumber);
    const profile = await this.usersService.getProfile(user.id);
    return { tokens, user: profile, restored };
  }

  refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokenService.rotateRefreshToken(refreshToken);
  }

  // Đăng xuất (tai-lieu-chuc-nang.md #72) — thu hồi refresh token phía server, không chỉ xoá token
  // ở client. Thiếu bước này thì 1 refresh token bị lộ vẫn dùng được tới 60 ngày dù user đã "đăng
  // xuất".
  logout(refreshToken: string): Promise<void> {
    return this.tokenService.revokeToken(refreshToken);
  }

  // Route GET /auth/me — user LUÔN đã tồn tại khi có JWT hợp lệ (được tạo lúc verify-otp), chỉ đọc
  // lại hồ sơ để client đồng bộ trạng thái, không cần provision nữa.
  me(authUser: AuthenticatedUser) {
    return this.usersService.getProfile(authUser.id);
  }
}
