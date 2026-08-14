import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PayoutRequest, UserBankAccount } from '@prisma/client';

import { encryptAccountNumber } from '../../common/utils/bank-account-crypto';
import {
  PAYMENT_GATEWAY,
  type IPaymentGateway,
} from '../../integrations/payment-gateway/payment-gateway.interface';
import {
  PAYOUT_GATEWAY,
  type IPayoutGateway,
} from '../../integrations/payout-gateway/payout-gateway.interface';
import { PrismaService } from '../../prisma/prisma.service';

import type { CreateSubscriptionDto } from './dto/create-subscription.dto';
import type { LinkBankAccountDto } from './dto/link-bank-account.dto';
import type { RequestPayoutDto } from './dto/request-payout.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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

  // Tạo yêu cầu chi hộ — thuần DB, không gọi gateway ở bước này. App không giữ tiền ở giữa tại bất
  // kỳ thời điểm nào (bussiness §11.2): PayoutRequest chỉ là ý định, tiền chỉ di chuyển thật khi
  // admin duyệt qua processPayout().
  async requestPayout(userId: string, dto: RequestPayoutDto): Promise<PayoutRequest> {
    const bankAccount = await this.prisma.userBankAccount.findUnique({
      where: { id: dto.bankAccountId },
    });
    if (!bankAccount || bankAccount.userId !== userId) {
      throw new BadRequestException('Tài khoản ngân hàng không hợp lệ');
    }
    return this.prisma.payoutRequest.create({
      data: { userId, bankAccountId: dto.bankAccountId, amount: dto.amount, source: dto.source },
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

  // Admin duyệt — gọi thẳng MomoPayoutService stub nên sẽ ném NotImplementedException tới khi nối
  // API thật. Tách riêng khỏi requestPayout() đúng nguyên tắc "app không giữ tiền ở giữa".
  async processPayout(payoutRequestId: string) {
    const payout = await this.prisma.payoutRequest.findUnique({ where: { id: payoutRequestId } });
    if (!payout) throw new NotFoundException('Không tìm thấy yêu cầu chi hộ');

    const result = await this.payoutGateway.transfer(payout.amount, payout.bankAccountId);
    return this.prisma.payoutRequest.update({
      where: { id: payoutRequestId },
      data: {
        status: result.status === 'success' ? 'success' : 'processing',
        providerTransactionId: result.providerTransactionId,
      },
    });
  }
}
