// Hàm thuần tính chi phí vận hành G8 (tai-lieu-chuc-nang.md #110, bussiness §9.7) — tách khỏi
// CostEstimateService để test không cần mock Prisma. ƯỚC LƯỢNG, không phải số hoá đơn thật — không
// gọi API Cloudflare R2/nhà cung cấp SMS thật, chỉ nhân số lượng đã đếm được với đơn giá cấu hình.
export interface CostEstimateInputs {
  smsCount: number;
  imageCount: number;
  activeUsers: number;
  smsUnitCostVnd: number;
  storageCostPerGbMonthVnd: number;
  avgImageSizeMb: number;
}

export interface CostEstimate {
  smsCostVnd: number;
  storageCostVndPerMonth: number;
  visionApiCostVnd: number;
  totalCostVnd: number;
  costPerActiveUserVnd: number | null;
}

export function computeCostEstimate(input: CostEstimateInputs): CostEstimate {
  const smsCostVnd = Math.round(input.smsCount * input.smsUnitCostVnd);
  const storageGb = (input.imageCount * input.avgImageSizeMb) / 1024;
  const storageCostVndPerMonth = Math.round(storageGb * input.storageCostPerGbMonthVnd);
  // Vision API chưa được gọi ở bất kỳ đâu trong hệ thống (chưa tích hợp) — chi phí thật sự là 0,
  // không phải "chưa tính được".
  const visionApiCostVnd = 0;
  const totalCostVnd = smsCostVnd + storageCostVndPerMonth + visionApiCostVnd;

  return {
    smsCostVnd,
    storageCostVndPerMonth,
    visionApiCostVnd,
    totalCostVnd,
    costPerActiveUserVnd:
      input.activeUsers === 0 ? null : Math.round(totalCostVnd / input.activeUsers),
  };
}
