import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { DailyMetricsSnapshotService } from './daily-metrics-snapshot.service';

// Tính snapshot G2-G4 cho ngày HÔM QUA (đã kết thúc hẳn), mỗi ngày lúc 3h sáng — cùng giờ với
// ReferralQualificationCronService để tránh chồng chéo với giờ cao điểm dùng app buổi tối.
@Injectable()
export class DailyMetricsSnapshotCronService {
  private readonly logger = new Logger(DailyMetricsSnapshotCronService.name);

  constructor(private readonly snapshotService: DailyMetricsSnapshotService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run(): Promise<void> {
    await this.snapshotService.computeAndStoreDailySnapshots();
    this.logger.log('Đã tính xong snapshot G2-G4 cho ngày hôm qua.');
  }
}
