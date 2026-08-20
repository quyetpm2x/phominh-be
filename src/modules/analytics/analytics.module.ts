import { Module } from '@nestjs/common';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { CostEstimateService } from './cost-estimate.service';
import { DailyMetricsSnapshotCronService } from './daily-metrics-snapshot-cron.service';
import { DailyMetricsSnapshotService } from './daily-metrics-snapshot.service';
import { SafetyReportService } from './safety-report.service';

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    DailyMetricsSnapshotService,
    DailyMetricsSnapshotCronService,
    SafetyReportService,
    CostEstimateService,
  ],
})
export class AnalyticsModule {}
