import { retryWithBackoff } from './retry.util';

describe('retryWithBackoff', () => {
  it('thành công ngay lần đầu — không retry', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    await expect(retryWithBackoff(fn, { baseDelayMs: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('lỗi vài lần rồi thành công → trả kết quả thành công', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('lỗi mạng tạm thời'))
      .mockRejectedValueOnce(new Error('lỗi mạng tạm thời'))
      .mockResolvedValue('ok');
    await expect(retryWithBackoff(fn, { maxAttempts: 5, baseDelayMs: 1 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('hết số lần thử → ném lại đúng lỗi gốc của lần cuối', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('vẫn lỗi'));
    await expect(retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow(
      'vẫn lỗi',
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
