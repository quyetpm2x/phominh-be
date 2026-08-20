import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';

import type { AdminLoginDto } from './dto/admin-login.dto';
import type { ChangeAdminPasswordDto } from './dto/change-admin-password.dto';
import type { CreateAdminDto } from './dto/create-admin.dto';
import type { UpdateAdminPermissionsDto } from './dto/update-admin-permissions.dto';

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

  // Hồ sơ của chính admin đang đăng nhập — JWT payload chỉ có {id, email, isOwner} (không có
  // name), nên FE cần route riêng để lấy đủ thông tin hiển thị (avatar/tên) thay vì đọc từ token.
  async getMe(adminId: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Không tìm thấy tài khoản admin');
    return { id: admin.id, email: admin.email, name: admin.name, isOwner: admin.isOwner };
  }

  // Admin tự đổi mật khẩu của chính mình — khác updatePermissions() (Owner sửa quyền của người
  // khác), route này không cần permission 'manage_admins' vì ai cũng được đổi mật khẩu bản thân.
  async changePassword(adminId: string, dto: ChangeAdminPasswordDto) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Không tìm thấy tài khoản admin');
    if (!(await bcrypt.compare(dto.currentPassword, admin.passwordHash))) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.adminUser.update({ where: { id: adminId }, data: { passwordHash } });
    return { success: true };
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

  // Xem danh sách toàn bộ tài khoản admin hiện có (tai-lieu-chuc-nang.md #113) — trước đây KHÔNG
  // có route nào, FE chỉ render mock tĩnh dù #111 (tạo admin) đã hoạt động thật từ trước.
  async listAdmins() {
    const admins = await this.prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
      include: { permissions: { include: { permission: true } } },
    });
    return admins.map((a) => ({
      id: a.id,
      email: a.email,
      name: a.name,
      isOwner: a.isOwner,
      createdAt: a.createdAt,
      permissionKeys: a.permissions.map((p) => p.permission.permissionKey),
    }));
  }

  // Sửa/thu hồi quyền admin đã cấp (tai-lieu-chuc-nang.md #112) — trước đây không có route
  // PATCH/DELETE nào, quyền chỉ gán được lúc tạo (#111). Owner tự bỏ qua toàn bộ check quyền
  // (AdminPermissionGuard) nên sửa permissionKeys của 1 owner không có tác dụng thực tế.
  async updatePermissions(
    targetAdminId: string,
    dto: UpdateAdminPermissionsDto,
    updatedByAdminId: string,
  ) {
    const target = await this.prisma.adminUser.findUnique({ where: { id: targetAdminId } });
    if (!target) throw new NotFoundException('Không tìm thấy tài khoản admin');

    const permissions = await this.prisma.permission.findMany({
      where: { permissionKey: { in: dto.permissionKeys } },
    });

    await this.prisma.$transaction([
      this.prisma.adminUserPermission.deleteMany({ where: { adminUserId: targetAdminId } }),
      ...(permissions.length
        ? [
            this.prisma.adminUserPermission.createMany({
              data: permissions.map((p) => ({ adminUserId: targetAdminId, permissionId: p.id })),
            }),
          ]
        : []),
      this.prisma.adminActionLog.create({
        data: {
          adminUserId: updatedByAdminId,
          action: 'update_admin_permissions',
          targetType: 'admin_user',
          targetId: targetAdminId,
        },
      }),
    ]);

    return { id: targetAdminId, permissionKeys: permissions.map((p) => p.permissionKey) };
  }
}
