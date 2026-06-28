import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShareInvite } from './entities/share-invite.entity';
import { SharingService } from './sharing.service';
import { SharingController } from './sharing.controller';
import { DocumentsModule } from '../documents/documents.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([ShareInvite]), DocumentsModule, MailModule, UsersModule],
  providers: [SharingService],
  controllers: [SharingController],
  exports: [SharingService],
})
export class SharingModule {}
