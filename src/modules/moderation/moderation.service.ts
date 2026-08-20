import { ForbiddenException, Injectable, NotImplementedException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

// Scaffold only — 4 thuật toán "lớp bảo vệ" (tai-lieu-cong-nghe-backend §7D.2 #4,#5,#7,
// bussiness §4.2b) cần dữ liệu/thuật toán chưa sẵn sàng ở base scaffold này:
//  - checkExifMismatch: Tầng 1 tự động — cần parser EXIF cho ảnh (chưa chọn thư viện).
//  - detectVoteCollusion: thuật toán đồ thị (graph-based) — cần định nghĩa "cụm bất thường" cụ thể.
//  - detectCommentAttack: time-series anomaly trên comments — ngưỡng "5 bình luận xấu/10 phút"
//    cần bộ phân loại "tiêu cực" (chưa chọn NLP/Vision).
// Khi implement thật, mỗi hàm ghi kết quả vào CollusionFlag/CommentAttackIncident (schema.prisma)
// rồi TrustScoreService.calculatePenalty() xử lý phần điểm phạt — không tự trừ điểm ở đây.

const ACCOUNT_BURST_WINDOW_MINUTES = 10;
const ACCOUNT_BURST_THRESHOLD = 5;
const ACCOUNT_BURST_LOOKBACK_DAYS = 7;

export interface FraudSignal {
  type: 'account_creation_burst' | 'duplicate_bank_account';
  summary: string;
  detail: string;
  relatedUserIds: string[];
  detectedAt: Date;
}

interface AccountBurstRow {
  bucket: Date;
  cnt: bigint;
  user_ids: string[];
}

interface DuplicateBankAccountRow {
  account_number_hash: string;
  user_ids: string[];
  user_count: bigint;
}

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  // GPS giả (bussiness §7A.3) — CHỈ dựa vào cờ thiết bị tự báo (expo-location Location.mocked, chỉ
  // đáng tin trên Android). ĐÃ BỎ phần "đối chiếu IP" so với bản dự tính gốc — định vị theo IP trên
  // mạng di động Việt Nam sai số lớn (NAT qua nhà mạng), dễ báo nhầm hàng loạt user thật là giả mạo.
  // Chặn ngay lúc tạo bài (không phải cờ để duyệt sau) — post GPS giả không có giá trị hyperlocal.
  checkMockGps(deviceReportedIsMock: boolean): void {
    if (deviceReportedIsMock) {
      throw new ForbiddenException('Vị trí giả (mock GPS) không được phép dùng để đăng bài');
    }
  }

  checkExifMismatch(_postId: string): Promise<void> {
    throw new NotImplementedException(
      'checkExifMismatch — chưa chọn thư viện đọc EXIF cho ảnh upload',
    );
  }

  detectVoteCollusion(): Promise<void> {
    throw new NotImplementedException(
      'detectVoteCollusion — thuật toán đồ thị chưa thiết kế cụ thể (bussiness §7D.2 #4)',
    );
  }

  detectCommentAttack(_postId: string): Promise<void> {
    throw new NotImplementedException(
      'detectCommentAttack — cần bộ phân loại bình luận tiêu cực (bussiness §7D.2 #5)',
    );
  }

  // Tín hiệu gian lận tổng hợp (tai-lieu-chuc-nang.md #94) — CỜ THAM KHẢO, không tự động khoá ai,
  // admin tự xem xét rồi quyết định (dẫn sang C2 — AdminUserQueriesService.revealDetail). Bản mock
  // gốc (PLACEHOLDER_SCREENS.C4) liệt kê 3 tín hiệu, nhưng 2 trong số đó KHÔNG làm được ở base này vì
  // hạ tầng chưa tồn tại: "nhiều tài khoản cùng 1 thiết bị" (không có Device ID nào được ghi ở bất kỳ
  // đâu — khớp quyết định đã chốt ở bussiness §4.4, coi Device ID chỉ là tín hiệu phụ dễ lách) và "IP
  // trùng lặp giữa các tài khoản vote qua lại" (không có IP nào được ghi theo user/request). Thay vào
  // đó dùng 2 tín hiệu THẬT tính được từ dữ liệu sẵn có: tốc độ tạo tài khoản bất thường, và số tài
  // khoản ngân hàng bị trùng giữa nhiều tài khoản Phố Mình (rào cản chống gian lận CHÍNH theo bussiness
  // §11 — xem phát hiện + vá ở mục 53, PaymentsService.linkBankAccount() giờ chặn liên kết mới trùng,
  // đây là phần XEM LẠI những trường hợp trùng từ trước khi có rào cản đó, hoặc lọt qua race condition).
  async getFraudSignals(): Promise<FraudSignal[]> {
    const [bursts, duplicateBankAccounts] = await Promise.all([
      this.findAccountCreationBursts(),
      this.findDuplicateBankAccounts(),
    ]);
    return [...duplicateBankAccounts, ...bursts].sort(
      (a, b) => b.detectedAt.getTime() - a.detectedAt.getTime(),
    );
  }

  private async findAccountCreationBursts(): Promise<FraudSignal[]> {
    const rows = await this.prisma.$queryRaw<AccountBurstRow[]>`
      select
        date_trunc('hour', created_at)
          + (floor(extract(minute from created_at) / ${ACCOUNT_BURST_WINDOW_MINUTES})
             * ${ACCOUNT_BURST_WINDOW_MINUTES}) * interval '1 minute' as bucket,
        count(*) as cnt,
        array_agg(id::text) as user_ids
      from users
      where created_at > now() - (${ACCOUNT_BURST_LOOKBACK_DAYS}::int * interval '1 day')
      group by bucket
      having count(*) >= ${ACCOUNT_BURST_THRESHOLD}
      order by bucket desc
    `;
    return rows.map((r) => ({
      type: 'account_creation_burst' as const,
      summary: `${r.cnt} tài khoản mới trong ${ACCOUNT_BURST_WINDOW_MINUTES} phút`,
      detail: `Tạo dồn dập lúc ${r.bucket.toLocaleString('vi-VN')} — vượt ngưỡng ${ACCOUNT_BURST_THRESHOLD} tài khoản/${ACCOUNT_BURST_WINDOW_MINUTES} phút.`,
      relatedUserIds: r.user_ids,
      detectedAt: r.bucket,
    }));
  }

  private async findDuplicateBankAccounts(): Promise<FraudSignal[]> {
    const rows = await this.prisma.$queryRaw<DuplicateBankAccountRow[]>`
      select account_number_hash, array_agg(distinct user_id::text) as user_ids, count(distinct user_id) as user_count
      from user_bank_accounts
      where account_number_hash is not null
      group by account_number_hash
      having count(distinct user_id) > 1
    `;
    const now = new Date();
    return rows.map((r) => ({
      type: 'duplicate_bank_account' as const,
      summary: `1 số tài khoản ngân hàng gắn với ${r.user_count} tài khoản Phố Mình`,
      detail:
        'Vi phạm trực tiếp rào cản "1 số tài khoản ngân hàng = 1 tài khoản" (bussiness §11) — có thể lọt qua trước khi chặn được thêm, hoặc do race condition liên kết cùng lúc.',
      relatedUserIds: r.user_ids,
      detectedAt: now,
    }));
  }
}
