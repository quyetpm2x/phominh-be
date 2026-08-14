import { distanceMeters } from './emergency-distance.util';

describe('distanceMeters — xác minh khẩn cấp trong bán kính nhỏ (tai-lieu-chuc-nang.md #7e)', () => {
  it('cùng 1 điểm => khoảng cách 0', () => {
    const p = { lat: 21.0278, lng: 105.8342 };
    expect(distanceMeters(p, p)).toBeCloseTo(0, 5);
  });

  it('2 điểm cách nhau đúng khoảng 1 độ vĩ độ => ~111km', () => {
    const a = { lat: 21.0, lng: 105.8 };
    const b = { lat: 22.0, lng: 105.8 };
    expect(distanceMeters(a, b)).toBeGreaterThan(110_000);
    expect(distanceMeters(a, b)).toBeLessThan(112_000);
  });

  it('2 điểm gần nhau trong 1 quận (~500m) => dưới 1km', () => {
    // Hồ Gươm và Nhà thờ Lớn Hà Nội — cách nhau thực tế khoảng 500-600m.
    const hoGuom = { lat: 21.0287, lng: 105.8524 };
    const nhaThoLon = { lat: 21.0294, lng: 105.8467 };
    const d = distanceMeters(hoGuom, nhaThoLon);
    expect(d).toBeGreaterThan(400);
    expect(d).toBeLessThan(1000);
  });
});
