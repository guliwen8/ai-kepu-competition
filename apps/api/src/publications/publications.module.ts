import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PublicationsAdminController } from './publications.admin.controller';
import { PublicationsPublicController } from './publications.public.controller';
import { PublicationsService } from './publications.service';

@Module({
  imports: [PrismaModule],
  controllers: [PublicationsPublicController, PublicationsAdminController],
  providers: [PublicationsService],
})
export class PublicationsModule {}
