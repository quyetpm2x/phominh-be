import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { PostsModule } from '../posts/posts.module';

import { SeedContentController } from './seed-content.controller';
import { SeedContentService } from './seed-content.service';

@Module({
  imports: [PrismaModule, PostsModule],
  controllers: [SeedContentController],
  providers: [SeedContentService],
})
export class SeedContentModule {}
