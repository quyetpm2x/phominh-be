import { engagementWeight, toBaseSummary, type PostRow } from './post-row.util';

describe('post-row.util', () => {
  function baseRow(overrides: Partial<PostRow> = {}): PostRow {
    return {
      id: 'post-1',
      author_id: 'author-1',
      post_type: 'life',
      content: 'nội dung',
      lat: 10,
      lng: 106,
      display_mode: 'alias',
      is_library_photo: false,
      vote_count: 0,
      comment_count: 0,
      expires_at: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
      author_alias: 'Cá Voi Xanh',
      author_real_name: 'Nguyễn Văn A',
      image_url: null,
      ...overrides,
    };
  }

  describe('toBaseSummary', () => {
    it('displayMode=alias => KHÔNG lộ real_name, dùng alias', () => {
      const summary = toBaseSummary(baseRow({ display_mode: 'alias' }));
      expect(summary.authorDisplayName).toBe('Cá Voi Xanh');
    });

    it('displayMode=real_name => hiện real_name', () => {
      const summary = toBaseSummary(baseRow({ display_mode: 'real_name' }));
      expect(summary.authorDisplayName).toBe('Nguyễn Văn A');
    });

    it('displayMode=real_name nhưng chưa đặt real_name => fallback alias', () => {
      const summary = toBaseSummary(baseRow({ display_mode: 'real_name', author_real_name: null }));
      expect(summary.authorDisplayName).toBe('Cá Voi Xanh');
    });
  });

  describe('engagementWeight', () => {
    it('bình luận tính trọng số bằng 1 nửa vote', () => {
      expect(engagementWeight(0, 2)).toBe(1);
      expect(engagementWeight(3, 0)).toBe(3);
      expect(engagementWeight(2, 4)).toBe(4);
    });
  });
});
