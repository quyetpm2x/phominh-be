export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

// Retry với backoff nhân đôi — dùng khi gọi API đối tác thanh toán (chi hộ Momo/VNPay), tránh 1 lỗi
// mạng/timeout tạm thời làm hỏng cả luồng chi tiền thật. KHÔNG retry vô hạn — hết maxAttempts thì
// ném lại lỗi gốc để nơi gọi tự quyết định (VD đánh dấu PayoutRequest.status='failed').
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  { maxAttempts = 3, baseDelayMs = 500 }: RetryOptions = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)));
      }
    }
  }
  throw lastError;
}
