import {
  availablePayoutAmounts,
  isBankLinkCooldownPassed,
  isRewardsActivated,
  isValidPayoutAmount,
  netPayoutAmount,
  requiresManualAdminApproval,
  rewardForRank,
  taxWithheld,
  topRewardForTier,
} from './reward-payout.util';

describe('isRewardsActivated', () => {
  it('kích hoạt đúng mốc 100 user (bussiness §5.1c/d)', () => {
    expect(isRewardsActivated(99)).toBe(false);
    expect(isRewardsActivated(100)).toBe(true);
  });
});

describe('topRewardForTier / rewardForRank', () => {
  it('khớp bảng hệ số bậc trong tài liệu', () => {
    expect(topRewardForTier(0)).toBe(300_000);
    expect(topRewardForTier(3)).toBe(600_000);
    expect(topRewardForTier(6)).toBe(1_200_000);
  });

  it('clamp bậc ngoài khoảng 0-6', () => {
    expect(topRewardForTier(-1)).toBe(topRewardForTier(0));
    expect(topRewardForTier(9)).toBe(topRewardForTier(6));
  });

  it('hạng 1 = đúng topRewardForTier (25% ngân sách = 25% × (top÷25%))', () => {
    expect(rewardForRank(0, 1)).toBe(300_000);
  });

  it('hạng 2-10 theo đường cong %, hạng ngoài 1-10 = 0đ', () => {
    // budget bậc 0 = 300_000 / 0.25 = 1_200_000
    expect(rewardForRank(0, 2)).toBe(192_000); // 16%
    expect(rewardForRank(0, 10)).toBe(60_000); // 5%
    expect(rewardForRank(0, 11)).toBe(0);
    expect(rewardForRank(0, 0)).toBe(0);
  });
});

describe('payout amount rules (bội số 50.000đ)', () => {
  it('hợp lệ khi >= 50k, chia hết 50k, không vượt số dư', () => {
    expect(isValidPayoutAmount(50_000, 100_000)).toBe(true);
    expect(isValidPayoutAmount(100_000, 100_000)).toBe(true);
    expect(isValidPayoutAmount(30_000, 100_000)).toBe(false); // dưới sàn
    expect(isValidPayoutAmount(70_000, 100_000)).toBe(false); // không chia hết
    expect(isValidPayoutAmount(150_000, 100_000)).toBe(false); // vượt số dư
  });

  it('availablePayoutAmounts liệt kê đúng các mốc khả dụng', () => {
    expect(availablePayoutAmounts(120_000)).toEqual([50_000, 100_000]);
    expect(availablePayoutAmounts(40_000)).toEqual([]);
  });
});

describe('requiresManualAdminApproval', () => {
  it('luôn duyệt tay lần rút đầu tiên, hoặc vượt ngưỡng 2 triệu', () => {
    expect(requiresManualAdminApproval(50_000, true)).toBe(true);
    expect(requiresManualAdminApproval(2_000_000, false)).toBe(true);
    expect(requiresManualAdminApproval(1_000_000, false)).toBe(false);
  });
});

describe('thuế TNCN', () => {
  it('không khấu trừ dưới ngưỡng, 10% từ ngưỡng trở lên', () => {
    expect(taxWithheld(19_999_999)).toBe(0);
    expect(taxWithheld(20_000_000)).toBe(0); // đúng ngưỡng, chưa VƯỢT
    expect(taxWithheld(21_000_000)).toBe(2_100_000);
    expect(netPayoutAmount(21_000_000)).toBe(18_900_000);
  });
});

describe('isBankLinkCooldownPassed', () => {
  it('chưa đủ 72h thì chưa cho rút', () => {
    const linkedAt = new Date('2026-08-01T00:00:00Z');
    expect(isBankLinkCooldownPassed(linkedAt, new Date('2026-08-03T23:00:00Z'))).toBe(false);
    expect(isBankLinkCooldownPassed(linkedAt, new Date('2026-08-04T01:00:00Z'))).toBe(true);
  });
});
