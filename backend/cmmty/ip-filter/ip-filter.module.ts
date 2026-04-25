import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IpFilterService } from './ip-filter.service';
import { IpFilterMiddleware } from './ip-filter.middleware';
import { IpFilterAdminController } from './ip-filter-admin.controller';
import { IpRule } from './entities/ip-rule.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IpRule])],
  providers: [IpFilterService, IpFilterMiddleware],
  controllers: [IpFilterAdminController],
  exports: [IpFilterService, IpFilterMiddleware],
})
export class IpFilterModule {}
