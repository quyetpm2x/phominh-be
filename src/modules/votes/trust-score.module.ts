import { Global, Module } from '@nestjs/common';

import { TrustScoreService } from './trust-score.service';

// @Global vì TrustScoreService (thuần túy, không phụ thuộc gì) được dùng bởi cả UsersModule
// (hiển thị bậc huy hiệu) lẫn VotesModule (tính trọng số vote) — tránh vòng lặp import giữa 2
// module đó nếu để trong VotesModule thường.
@Global()
@Module({
  providers: [TrustScoreService],
  exports: [TrustScoreService],
})
export class TrustScoreModule {}
