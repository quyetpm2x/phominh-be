import { isPostModifiable } from './post-lifecycle.util';

describe('isPostModifiable — điều kiện sửa/xoá bài đăng (tai-lieu-chuc-nang.md #33)', () => {
  const now = new Date('2026-01-01T12:00:00Z');

  it('bài active, chưa hết hạn => sửa/xoá được', () => {
    const future = new Date(now.getTime() + 60 * 60 * 1000);
    expect(isPostModifiable({ status: 'active', expiresAt: future }, now)).toBe(true);
  });

  it('bài khẩn cấp (expiresAt=null, không tự hết hạn) => luôn sửa/xoá được khi còn active', () => {
    expect(isPostModifiable({ status: 'active', expiresAt: null }, now)).toBe(true);
  });

  it('bài đã hết hạn => không sửa/xoá được', () => {
    const past = new Date(now.getTime() - 60 * 60 * 1000);
    expect(isPostModifiable({ status: 'active', expiresAt: past }, now)).toBe(false);
  });

  it('bài đã bị xoá (status=removed) => không sửa/xoá lại được', () => {
    const future = new Date(now.getTime() + 60 * 60 * 1000);
    expect(isPostModifiable({ status: 'removed', expiresAt: future }, now)).toBe(false);
  });

  it('bài đã tự chuyển expired => không sửa/xoá được', () => {
    const future = new Date(now.getTime() + 60 * 60 * 1000);
    expect(isPostModifiable({ status: 'expired', expiresAt: future }, now)).toBe(false);
  });
});
