import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeyController } from './controllers/api-key.controller';
import { ApiKeyService } from './providers/api-key.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { AuthModule } from 'src/auth/auth.module';
import { ApiKeyCleanupService } from './providers/api-key-cleanup.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApiKey]), forwardRef(() => AuthModule)],
  controllers: [ApiKeyController],
  providers: [ApiKeyService, ApiKeyGuard, ApiKeyCleanupService],
  exports: [ApiKeyService, ApiKeyGuard],
})
export class ApiKeyModule {}
