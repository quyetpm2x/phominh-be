import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard, type AuthenticatedUser } from '../../common/guards/jwt-auth.guard';

import { AddMenuPhotoDto } from './dto/add-menu-photo.dto';
import { RegisterMerchantDto } from './dto/register-merchant.dto';
import { UpdatePhoneVisibilityDto } from './dto/update-phone-visibility.dto';
import { MerchantsService } from './merchants.service';

@ApiTags('merchants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/mobile/merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Post()
  register(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterMerchantDto) {
    return this.merchantsService.register(user.id, dto);
  }

  @Get('me')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.merchantsService.getMine(user.id);
  }

  @Patch('me/phone-visibility')
  updatePhoneVisibility(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePhoneVisibilityDto,
  ) {
    return this.merchantsService.updatePhoneVisibility(user.id, dto);
  }

  // "Ảnh Menu" — tách khỏi feed real-time, không tính vào xếp hạng độ mới (bussiness §2.1).
  @Post('me/menu-photos')
  addMenuPhoto(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddMenuPhotoDto) {
    return this.merchantsService.addMenuPhoto(user.id, dto.url, dto.caption);
  }
}
