import { TrustScoreService } from './trust-score.service';

describe('TrustScoreService — điểm uy tín 3 lớp (bussiness §4.2 / tai-lieu-cong-nghe-backend §7.3)', () => {
  const trustScore = new TrustScoreService();

  describe('getBadgeTier — 7 bậc theo mốc lũy thừa 10 (bussiness §4.2d)', () => {
    it.each([
      [0, 0],
      [99, 0],
      [100, 1],
      [999, 1],
      [1_000, 2],
      [9_999, 2],
      [10_000, 3],
      [49_999, 3],
      [50_000, 4],
      [199_999, 4],
      [200_000, 5],
      [499_999, 5],
      [500_000, 6],
      [1_000_000, 6],
    ])('điểm %i → bậc %i', (score, expectedTier) => {
      expect(trustScore.getBadgeTier(score)).toBe(expectedTier);
    });
  });

  describe('getActivityFactor — hệ số hoạt động theo lần mở app gần nhất (bussiness §4.2c)', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

    it('trong 90 ngày → 1.0', () => {
      expect(trustScore.getActivityFactor(daysAgo(1), now)).toBe(1.0);
      expect(trustScore.getActivityFactor(daysAgo(90), now)).toBe(1.0);
    });
    it('90-180 ngày → 0.7', () => {
      expect(trustScore.getActivityFactor(daysAgo(91), now)).toBe(0.7);
      expect(trustScore.getActivityFactor(daysAgo(180), now)).toBe(0.7);
    });
    it('>180 ngày → 0.4', () => {
      expect(trustScore.getActivityFactor(daysAgo(181), now)).toBe(0.4);
    });
  });

  describe('calculateVoteWeight — trọng số vote dừng tăng ở bậc 3 (bussiness §4.2d)', () => {
    const now = new Date('2026-01-01T00:00:00Z');

    it('bậc 0-3 tăng dần theo TIER_WEIGHT', () => {
      expect(trustScore.calculateVoteWeight(0, now, now)).toBeCloseTo(1.0);
      expect(trustScore.calculateVoteWeight(100, now, now)).toBeCloseTo(2.0);
      expect(trustScore.calculateVoteWeight(1_000, now, now)).toBeCloseTo(3.0);
      expect(trustScore.calculateVoteWeight(10_000, now, now)).toBeCloseTo(4.0);
    });

    it('bậc 4/5/6 KHÔNG tăng thêm quyền lực vote — trần ở bậc 3', () => {
      const tier3 = trustScore.calculateVoteWeight(10_000, now, now);
      const tier6 = trustScore.calculateVoteWeight(500_000, now, now);
      expect(tier6).toBeCloseTo(tier3);
    });

    it('nhân thêm hệ số hoạt động', () => {
      const inactiveVoter = new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000);
      const weight = trustScore.calculateVoteWeight(1_000, inactiveVoter, now); // bậc 2 → TIER_WEIGHT 3.0, hoạt động 0.4
      expect(weight).toBeCloseTo(3.0 * 0.4);
    });
  });

  describe('calculatePenalty — sàn/trần riêng theo bậc × mức độ (bussiness §4.2b)', () => {
    it('bậc 0, nhẹ: severityScore=0 → sàn (2), severityScore=1 → trần (5)', () => {
      expect(trustScore.calculatePenalty(0, 'light', 0)).toBeCloseTo(2);
      expect(trustScore.calculatePenalty(0, 'light', 1)).toBeCloseTo(5);
    });

    it('bậc 6, nghiêm trọng: severityScore=0.5 → giữa sàn/trần (8.000-15.000)', () => {
      expect(trustScore.calculatePenalty(6, 'severe', 0.5)).toBeCloseTo(
        8_000 + 0.5 * (15_000 - 8_000),
      );
    });

    it('cùng severity, bậc cao hơn bị phạt nặng hơn về số tuyệt đối', () => {
      const tier0 = trustScore.calculatePenalty(0, 'medium', 0.5);
      const tier6 = trustScore.calculatePenalty(6, 'medium', 0.5);
      expect(tier6).toBeGreaterThan(tier0);
    });
  });

  describe('getEffectivePenalty — phai hoàn toàn sau 180 ngày (bussiness §4.2b)', () => {
    const appliedAt = new Date('2026-01-01T00:00:00Z');

    it('ngay lúc áp dụng → hiệu lực = E2 gốc', () => {
      expect(trustScore.getEffectivePenalty(100, appliedAt, appliedAt)).toBeCloseTo(100);
    });

    it('sau 90 ngày → còn một nửa', () => {
      const later = new Date(appliedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
      expect(trustScore.getEffectivePenalty(100, appliedAt, later)).toBeCloseTo(50);
    });

    it('sau 180 ngày trở đi → phai hết, không âm', () => {
      const later = new Date(appliedAt.getTime() + 200 * 24 * 60 * 60 * 1000);
      expect(trustScore.getEffectivePenalty(100, appliedAt, later)).toBe(0);
    });
  });
});
