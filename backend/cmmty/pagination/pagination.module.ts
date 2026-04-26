import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CursorPaginationHelper } from './cursor-pagination';
import { DocumentsPaginationController } from './documents-pagination.controller';
import { Document } from '../../src/documents/entities/document.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  controllers: [DocumentsPaginationController],
  providers: [CursorPaginationHelper],
  exports: [CursorPaginationHelper],
})
export class PaginationModule {}