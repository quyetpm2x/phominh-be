import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ContactMessageDto } from './dto/contact-message.dto';
import { PilotSignupDto } from './dto/pilot-signup.dto';
import { RegisterMerchantLeadDto } from './dto/register-merchant-lead.dto';
import { PublicLeadsService } from './public-leads.service';

// Endpoint CÔNG KHAI, KHÔNG auth — nhận lead từ web marketing domain chính (tai-lieu-chuc-nang.md
// #75-83). Bảo vệ bằng ThrottlerGuard toàn cục (120 req/phút/IP, app.module.ts) — đủ cho quy mô
// form marketing, không cần rate-limit riêng.
@ApiTags('public')
@Controller('api/public')
export class PublicLeadsController {
  constructor(private readonly leads: PublicLeadsService) {}

  @Post('merchants')
  registerMerchant(@Body() dto: RegisterMerchantLeadDto): Promise<void> {
    return this.leads.registerMerchantLead(dto);
  }

  @Post('pilot-signups')
  registerPilotSignup(@Body() dto: PilotSignupDto): Promise<void> {
    return this.leads.registerPilotSignup(dto);
  }

  @Post('contact')
  submitContact(@Body() dto: ContactMessageDto): Promise<void> {
    return this.leads.submitContact(dto);
  }
}
