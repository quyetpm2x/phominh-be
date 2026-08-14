import { Global, Module } from '@nestjs/common';

import { TokenService } from './token.service';

// Global — tách khỏi AuthModule để UsersModule (AccountLifecycleService cần revoke token lúc khoá/
// xoá tài khoản) dùng được mà không tạo vòng lặp (AuthModule đã import UsersModule sẵn).
@Global()
@Module({
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}
