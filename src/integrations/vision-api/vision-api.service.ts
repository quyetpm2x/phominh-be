import { Injectable, NotImplementedException } from '@nestjs/common';

export interface ModerationResult {
  isSafe: boolean;
  flaggedCategories: string[];
}

// Stub — chưa nối Google Cloud Vision API thật (cần VISION_API_KEY, tài liệu bussiness §7).
// Dùng ở modules/moderation để chặn ảnh bạo lực/khoả thân trước khi hiển thị công khai. Khi bật
// BullMQ (jobs/, xem README deferral), gọi service này bên trong 1 job riêng thay vì đồng bộ trong
// request đăng bài, tránh block response.
@Injectable()
export class VisionApiService {
  moderateImage(_imageUrl: string): Promise<ModerationResult> {
    throw new NotImplementedException(
      'VisionApiService.moderateImage chưa nối Google Cloud Vision API thật',
    );
  }
}
