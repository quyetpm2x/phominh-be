import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';

import type { AdminLoginDto } from './dto/admin-login.dto';
import type { CreateAdminDto } from './dto/create-admin.dto';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: AdminLoginDto) {
    const admin = await this.prisma.adminUser.findUnique({ where: { email: dto.email } });
    if (!admin || !(await bcrypt.compare(dto.password, admin.passwordHash))) {
      throw new UnauthorizedException('Sai email hoặc mật khẩu');
    }

    const accessToken = await this.jwtService.signAsync({
      id: admin.id,
      email: admin.email,
      isOwner: admin.isOwner,
    });
    return {
      accessToken,
      admin: { id: admin.id, email: admin.email, name: admin.name, isOwner: admin.isOwner },
    };
  }

  // Owner tự tích chọn permission cho từng admin mới — mô hình checkbox, không phải vai trò cố định
  // (bussiness §9.9). Guard ở controller đã đảm bảo caller có quyền 'manage_admins'.
  async createAdmin(dto: CreateAdminDto, createdByAdminId: string) {
    const existing = await this.prisma.adminUser.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email admin đã tồn tại');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const permissions = await this.prisma.permission.findMany({
      where: { permissionKey: { in: dto.permissionKeys } },
    });

    const admin = await this.prisma.$transaction(async (tx) => {
      const created = await tx.adminUser.create({
        data: { email: dto.email, passwordHash, name: dto.name },
      });
      if (permissions.length) {
        await tx.adminUserPermission.createMany({
          data: permissions.map((p) => ({ adminUserId: created.id, permissionId: p.id })),
        });
      }
      await tx.adminActionLog.create({
        data: {
          adminUserId: createdByAdminId,
          action: 'create_admin',
          targetType: 'admin_user',
          targetId: created.id,
        },
      });
      return created;
    });

    return { id: admin.id, email: admin.email, name: admin.name };
  }

  async listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ groupName: 'asc' }, { label: 'asc' }] });
  }
}
