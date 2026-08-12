import { RankingService } from './ranking.service';

describe('RankingService — công thức xếp hạng (tai-lieu-cong-nghe-backend §7.2 / bussiness §7A.2)', () => {
  const ranking = new RankingService();
  const now = new Date('2026-01-01T12:00:00Z');

  function baseInput(overrides: Partial<Parameters<RankingService['calculateScore']>[0]> = {}) {
    return {
      postType: 'life' as const,
      createdAt: now,
      isLibraryPhoto: false,
      distanceMeters: 0,
      engagementWeight: 0,
      maxRadiusKm: 2,
      ...overrides,
    };
  }

  it('tin khẩn cấp (N=0) không suy giảm theo thời gian', () => {
    const fresh = ranking.calculateScore(baseInput({ postType: 'emergency', createdAt: now }), now);
    const oneDayOld = ranking.calculateScore(
      baseInput({
        postType: 'emergency',
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      }),
      now,
    );
    expect(fresh).toBeCloseTo(oneDayOld, 10);
  });

  it('bài merchant (N=3.0) suy giảm nhanh hơn bài đời sống (N=1.8) sau cùng khoảng thời gian', () => {
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const merchantScore = ranking.calculateScore(
      baseInput({ postType: 'merchant', createdAt: sixHoursAgo }),
      now,
    );
    const lifeScore = ranking.calculateScore(
      baseInput({ postType: 'life', createdAt: sixHoursAgo }),
      now,
    );
    expect(merchantScore).toBeLessThan(lifeScore);
  });

  it('bài gần hơn có điểm cao hơn bài xa hơn, mọi thứ khác giữ nguyên', () => {
    const near = ranking.calculateScore(baseInput({ distanceMeters: 200 }), now);
    const far = ranking.calculateScore(baseInput({ distanceMeters: 1800 }), now);
    expect(near).toBeGreaterThan(far);
  });

  it('ảnh chụp trực tiếp (hệ số 1.3) được ưu tiên hơn ảnh thư viện (hệ số 1.0)', () => {
    const directPhoto = ranking.calculateScore(baseInput({ isLibraryPhoto: false }), now);
    const libraryPhoto = ranking.calculateScore(baseInput({ isLibraryPhoto: true }), now);
    expect(directPhoto).toBeCloseTo(libraryPhoto * 1.3, 10);
  });

  it('trọng số tương tác cao hơn cho điểm cao hơn (additive smoothing "+1")', () => {
    const noEngagement = ranking.calculateScore(baseInput({ engagementWeight: 0 }), now);
    const withEngagement = ranking.calculateScore(baseInput({ engagementWeight: 5 }), now);
    expect(withEngagement).toBeCloseTo(noEngagement * 6, 10); // (1+5)/(1+0) = 6
  });

  it('khớp công thức tính tay cho 1 bộ input cụ thể', () => {
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const score = ranking.calculateScore(
      {
        postType: 'life',
        createdAt: twoHoursAgo,
        isLibraryPhoto: false,
        distanceMeters: 500,
        engagementWeight: 2,
        maxRadiusKm: 2,
      },
      now,
    );
    // (1+2) * 1.3 / (2+2)^1.8 * (1 / (1 + 0.5/2))
    const expected = (1 + 2) * 1.3 * (1 / Math.pow(2 + 2, 1.8)) * (1 / (1 + 0.5 / 2));
    expect(score).toBeCloseTo(expected, 10);
  });
});
