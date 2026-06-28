import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UsersModule } from '../users/users.module';
import { DocumentsModule } from '../documents/documents.module';
import { QueueModule } from '../queue/queue.module';
import { User } from '../users/entities/user.entity';
import { Document } from '../documents/entities/document.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Document]),
    UsersModule,
    DocumentsModule,
    QueueModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
