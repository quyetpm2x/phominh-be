import {
  computePercentiles,
  emergencyRawScore,
  rankTierUsers,
  rankingScore,
  violationFactor,
  type UserPeriodStats,
} from './reward-score.util';

describe('computePercentiles', () => {
  it('người giá trị thô cao nhất luôn nhận percentile 100, thấp nhất theo hạng 1-based', () => {
    expect(computePercentiles([1, 3, 3, 5])).toEqual([25, 62.5, 62.5, 100]);
  });

  it('mảng rỗng trả về rỗng, 1 phần tử luôn 100 (giỏi nhất trong đúng nhóm của mình)', () => {
    expect(computePercentiles([])).toEqual([]);
    expect(computePercentiles([42])).toEqual([100]);
  });
});

describe('violationFactor', () => {
  it.each([
    [{ light: 0, medium: 0, severe: 0 }, 1.0],
    [{ light: 1, medium: 0, severe: 0 }, 0.9],
    [{ light: 0, medium: 1, severe: 0 }, 0.8],
    [{ light: 3, medium: 0, severe: 0 }, 0.7],
    [{ light: 0, medium: 2, severe: 0 }, 0.6],
    [{ light: 0, medium: 0, severe: 1 }, 0.5], // 1 lần Nghiêm trọng đã đạt sàn, không cần điều kiện riêng
    [{ light: 5, medium: 0, severe: 0 }, 0.5],
  ])('trọng số %j → hệ số %f', (counts, expected) => {
    expect(violationFactor(counts)).toBe(expected);
  });
});

describe('emergencyRawScore', () => {
  it('10 điểm/bài đăng, 3 điểm/lượt xác nhận', () => {
    expect(emergencyRawScore(2, 3)).toBe(29);
  });
});

describe('rankingScore', () => {
  it('4 yếu tố percentile=100 và không vi phạm → điểm tối đa 100', () => {
    const score = rankingScore(
      {
        deltaE1Percentile: 100,
        postCountPercentile: 100,
        regularityPercentile: 100,
        emergencyPercentile: 100,
      },
      1.0,
    );
    expect(score).toBe(100);
  });

  it('hệ số vi phạm nhân xuống điểm cuối', () => {
    const score = rankingScore(
      {
        deltaE1Percentile: 50,
        postCountPercentile: 50,
        regularityPercentile: 50,
        emergencyPercentile: 50,
      },
      0.5,
    );
    expect(score).toBe(25);
  });
});

describe('rankTierUsers', () => {
  const base: Omit<UserPeriodStats, 'userId' | 'createdAt'> = {
    deltaE1: 10,
    postCount: 5,
    activeDays: 5,
    confirmedEmergencyPosts: 0,
    cappedEmergencyConfirmations: 0,
    violations: { light: 0, medium: 0, severe: 0 },
  };

  it('user chỉ số thô cao hơn xếp hạng 1', () => {
    const stats: UserPeriodStats[] = [
      { ...base, userId: 'a', createdAt: new Date('2026-01-01') },
      {
        ...base,
        userId: 'b',
        deltaE1: 1,
        postCount: 1,
        activeDays: 1,
        createdAt: new Date('2026-06-01'),
      },
    ];
    const ranked = rankTierUsers(stats);
    expect(ranked.find((r) => r.userId === 'a')?.rank).toBe(1);
    expect(ranked.find((r) => r.userId === 'b')?.rank).toBe(2);
  });

  it('hoà tuyệt đối mọi yếu tố → tie-break bước 3: tài khoản tạo trước xếp cao hơn', () => {
    const stats: UserPeriodStats[] = [
      { ...base, userId: 'newer', createdAt: new Date('2026-06-01') },
      { ...base, userId: 'older', createdAt: new Date('2026-01-01') },
    ];
    const ranked = rankTierUsers(stats);
    expect(ranked.find((r) => r.userId === 'older')?.rank).toBe(1);
    expect(ranked.find((r) => r.userId === 'newer')?.rank).toBe(2);
  });

  it('mảng rỗng trả về rỗng', () => {
    expect(rankTierUsers([])).toEqual([]);
  });
});
