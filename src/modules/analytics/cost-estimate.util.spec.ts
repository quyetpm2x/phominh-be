import { computeCostEstimate } from './cost-estimate.util';

const BASE_UNIT_COSTS = { smsUnitCostVnd: 300, storageCostPerGbMonthVnd: 375, avgImageSizeMb: 0.5 };

describe('computeCostEstimate', () => {
  it('tính đúng chi phí SMS + lưu trữ, cộng lại thành tổng', () => {
    const result = computeCostEstimate({
      smsCount: 100,
      imageCount: 2048, // 2048 * 0.5MB / 1024 = 1 GB
      activeUsers: 50,
      ...BASE_UNIT_COSTS,
    });
    expect(result.smsCostVnd).toBe(30_000); // 100 * 300
    expect(result.storageCostVndPerMonth).toBe(375); // 1 GB * 375
    expect(result.visionApiCostVnd).toBe(0);
    expect(result.totalCostVnd).toBe(30_375);
  });

  it('activeUsers=0 → costPerActiveUserVnd null (không chia cho 0)', () => {
    const result = computeCostEstimate({
      smsCount: 10,
      imageCount: 0,
      activeUsers: 0,
      ...BASE_UNIT_COSTS,
    });
    expect(result.costPerActiveUserVnd).toBeNull();
  });

  it('chia đều tổng chi phí cho số user hoạt động, làm tròn', () => {
    const result = computeCostEstimate({
      smsCount: 10,
      imageCount: 0,
      activeUsers: 3,
      ...BASE_UNIT_COSTS,
    });
    expect(result.totalCostVnd).toBe(3_000); // 10 * 300
    expect(result.costPerActiveUserVnd).toBe(1_000); // 3000 / 3
  });

  it('visionApiCostVnd luôn 0 — chưa tích hợp', () => {
    const result = computeCostEstimate({
      smsCount: 0,
      imageCount: 0,
      activeUsers: 1,
      ...BASE_UNIT_COSTS,
    });
    expect(result.visionApiCostVnd).toBe(0);
  });
});
