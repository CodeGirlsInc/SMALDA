import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { ApiKeysService } from './api-keys.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DocumentsModule } from '../documents/documents.module';
import { AccessLogsModule } from '../access-logs/access-logs.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ApiKey]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
    DocumentsModule,
    AccessLogsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, ApiKeysService, ApiKeyAuthGuard, RolesGuard],
  exports: [UsersService, ApiKeysService],
})
export class UsersModule {}
