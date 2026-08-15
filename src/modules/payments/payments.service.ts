import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PayoutRequest, UserBankAccount } from '@prisma/client';

import { encryptAccountNumber } from '../../common/utils/bank-account-crypto';
import { retryWithBackoff } from '../../common/utils/retry.util';
import {
  PAYMENT_GATEWAY,
  type IPaymentGateway,
} from '../../integrations/payment-gateway/payment-gateway.interface';
import {
  PAYOUT_GATEWAY,
  type IPayoutGateway,
} from '../../integrations/payout-gateway/payout-gateway.interface';
import { PrismaService } from '../../prisma/prisma.service';
import {
  isBankLinkCooldownPassed,
  isValidPayoutAmount,
  netPayoutAmount,
  requiresManualAdminApproval,
  taxWithheld,
} from '../rewards/reward-payout.util';
import { RewardWalletService } from '../rewards/reward-wallet.service';

import type { CreateSubscriptionDto } from './dto/create-subscription.dto';
import type { LinkBankAccountDto } from './dto/link-bank-account.dto';
import type { RequestPayoutDto } from './dto/request-payout.dto';

export interface PayoutRequestResult {
  payoutRequest: PayoutRequest;
  taxWithheld: number;
  netAmount: number;
  requiresManualApproval: boolean;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly rewardWallet: RewardWalletService,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: IPaymentGateway,
    @Inject(PAYOUT_GATEWAY) private readonly payoutGateway: IPayoutGateway,
  ) {}

  // Luồng 1 (tiền vào) — DTO/luồng thật, nhưng gọi thẳng vào VnpayPaymentService stub nên sẽ ném
  // NotImplementedException tới khi implement thật (bussiness §11.1).
  async createSubscription(merchantId: string, dto: CreateSubscriptionDto) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new NotFoundException('Không tìm thấy hồ sơ quán');

    const subscription = await this.prisma.merchantSubscription.create({
      data: {
        merchantId,
        planKey: dto.planKey,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending',
      },
    });
    const paymentResult = await this.paymentGateway.createPayment(dto.amountVnd, subscription.id);
    return this.prisma.paymentTransaction.create({
      data: {
        merchantId,
        subscriptionId: subscription.id,
        amount: dto.amountVnd,
        provider: 'vnpay',
        providerTransactionId: paymentResult.providerTransactionId,
        status: paymentResult.status,
      },
    });
  }

  async linkBankAccount(userId: string, dto: LinkBankAccountDto): Promise<UserBankAccount> {
    const secret = this.config.getOrThrow<string>('BANK_ACCOUNT_ENCRYPTION_KEY');
    return this.prisma.userBankAccount.create({
      data: {
        userId,
        bankCode: dto.bankCode,
        accountNumberEncrypted: encryptAccountNumber(dto.accountNumber, secret),
        accountHolderName: dto.accountHolderName,
      },
    });
  }

  async getMyBankAccounts(
    userId: string,
  ): Promise<Omit<UserBankAccount, 'accountNumberEncrypted'>[]> {
    const accounts = await this.prisma.userBankAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    // KHÔNG trả accountNumberEncrypted về client — chỉ dùng nội bộ lúc gọi gateway thật.
    return accounts.map(({ accountNumberEncrypted: _omit, ...rest }) => rest);
  }

  // Tạo yêu cầu chi hộ + validate đầy đủ (bussiness §5.1e): eKYC đã xác thực, đủ 48-72h sau liên kết
  // lần đầu, đúng bội số 50.000đ, không vượt số dư ví. Trừ ví NGAY (giữ chỗ số dư) — app không giữ
  // tiền ở giữa tại bất kỳ thời điểm nào, tiền chỉ thật sự rời hệ thống khi admin duyệt qua
  // processPayout(); nếu gateway báo lỗi ở bước đó, hoàn lại ví (xem processPayout).
  async requestPayout(userId: string, dto: RequestPayoutDto): Promise<PayoutRequestResult> {
    const bankAccount = await this.prisma.userBankAccount.findFirst({
      where: { id: dto.bankAccountId, userId },
    });
    if (!bankAccount) throw new NotFoundException('Không tìm thấy tài khoản ngân hàng đã liên kết');
    if (!bankAccount.verifiedAt) {
      throw new BadRequestException('Tài khoản ngân hàng chưa xác thực eKYC');
    }
    if (!isBankLinkCooldownPassed(bankAccount.createdAt)) {
      throw new BadRequestException(
        'Cần chờ 48-72h sau khi liên kết ngân hàng lần đầu mới được rút',
      );
    }

    const balance = await this.rewardWallet.getBalance(userId);
    if (!isValidPayoutAmount(dto.amount, balance)) {
      throw new BadRequestException(
        'Số tiền rút không hợp lệ — phải là bội số 50.000đ, tối thiểu 50.000đ và không vượt số dư',
      );
    }

    const successfulPayoutCount = await this.prisma.payoutRequest.count({
      where: { userId, status: 'success' },
    });

    const payoutRequest = await this.prisma.payoutRequest.create({
      data: { userId, bankAccountId: dto.bankAccountId, amount: dto.amount, source: dto.source },
    });
    await this.rewardWallet.credit(userId, -dto.amount, 'payout', payoutRequest.id);

    return {
      payoutRequest,
      taxWithheld: taxWithheld(dto.amount),
      netAmount: netPayoutAmount(dto.amount),
      requiresManualApproval: requiresManualAdminApproval(dto.amount, successfulPayoutCount === 0),
    };
  }

  async getMyPayoutRequests(userId: string): Promise<PayoutRequest[]> {
    return this.prisma.payoutRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Lịch sử thanh toán gói merchant (tai-lieu-chuc-nang.md #46) — kèm luôn subscription liên quan
  // (planKey, hạn dùng) để FE không phải gọi thêm API.
  async getPaymentHistory(userId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { userId } });
    if (!merchant) throw new NotFoundException('Chưa có hồ sơ quán');

    return this.prisma.paymentTransaction.findMany({
      where: { merchantId: merchant.id },
      orderBy: { createdAt: 'desc' },
      include: { subscription: { select: { planKey: true, expiresAt: true } } },
    });
  }

  // Admin duyệt — gọi gateway thật (có retry backoff, tránh 1 lỗi mạng tạm thời làm hỏng cả luồng
  // chi tiền). Nếu gateway lỗi hẳn sau khi hết số lần retry, HOÀN LẠI ví (đã trừ lúc requestPayout)
  // và đánh dấu failed — không được để tiền "biến mất" khỏi ví mà không rõ lý do.
  async processPayout(payoutRequestId: string): Promise<PayoutRequest> {
    const payout = await this.prisma.payoutRequest.findUnique({ where: { id: payoutRequestId } });
    if (!payout) throw new NotFoundException('Không tìm thấy yêu cầu chi hộ');

    try {
      const result = await retryWithBackoff(() =>
        this.payoutGateway.transfer(payout.amount, payout.bankAccountId),
      );
      return this.prisma.payoutRequest.update({
        where: { id: payoutRequestId },
        data: {
          status: result.status === 'success' ? 'success' : 'processing',
          providerTransactionId: result.providerTransactionId,
        },
      });
    } catch (error) {
      this.logger.error(
        `Chi hộ thất bại cho payoutRequestId=${payoutRequestId}: ${(error as Error).message}`,
      );
      await this.rewardWallet.credit(payout.userId, payout.amount, 'payout', payout.id);
      return this.prisma.payoutRequest.update({
        where: { id: payoutRequestId },
        data: { status: 'failed' },
      });
    }
  }

  // Webhook callback trạng thái từ đối tác (chữ ký đã verify ở controller trước khi gọi vào đây) —
  // đối tác báo "processing" chuyển "failed" sau (khác lỗi ngay lúc gọi transfer(), xử lý ở
  // processPayout()) — vẫn cần hoàn ví vì tiền chưa thật sự rời hệ thống.
  async handlePayoutWebhook(
    providerTransactionId: string,
    status: 'success' | 'failed',
  ): Promise<void> {
    const payout = await this.prisma.payoutRequest.findFirst({ where: { providerTransactionId } });
    if (!payout) {
      this.logger.warn(
        `Webhook chi hộ: không tìm thấy providerTransactionId=${providerTransactionId}`,
      );
      return;
    }
    if (payout.status === status) return; // đã xử lý, tránh cộng/trừ ví trùng nếu webhook gửi lại

    if (status === 'failed') {
      await this.rewardWallet.credit(payout.userId, payout.amount, 'payout', payout.id);
    }
    await this.prisma.payoutRequest.update({ where: { id: payout.id }, data: { status } });
  }
}
