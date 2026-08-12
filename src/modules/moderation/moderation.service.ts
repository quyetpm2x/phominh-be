import { Injectable, NotImplementedException } from '@nestjs/common';

// Scaffold only — 4 thuật toán "lớp bảo vệ" (tai-lieu-cong-nghe-backend §7D.2 #4,#5,#7,
// bussiness §4.2b) cần dữ liệu/thuật toán chưa sẵn sàng ở base scaffold này:
//  - checkMockGps/checkExifMismatch: Tầng 1 tự động — cần expo-location trả isFromMockProvider()
//    thật từ client + parser EXIF cho ảnh (chưa chọn thư viện).
//  - detectVoteCollusion: thuật toán đồ thị (graph-based) — cần định nghĩa "cụm bất thường" cụ thể.
//  - detectCommentAttack: time-series anomaly trên comments — ngưỡng "5 bình luận xấu/10 phút"
//    cần bộ phân loại "tiêu cực" (chưa chọn NLP/Vision).
// Khi implement thật, mỗi hàm ghi kết quả vào CollusionFlag/CommentAttackIncident (schema.prisma)
// rồi TrustScoreService.calculatePenalty() xử lý phần điểm phạt — không tự trừ điểm ở đây.
@Injectable()
export class ModerationService {
  checkMockGps(_deviceReportedIsMock: boolean, _postId: string): Promise<void> {
    throw new NotImplementedException(
      'checkMockGps — chờ xác nhận expo-location expose isFromMockProvider() (bussiness §7A.3)',
    );
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
}
