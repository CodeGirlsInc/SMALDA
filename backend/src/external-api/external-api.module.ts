import { Module } from '@nestjs/common';
import { ExternalApiController } from './external-api.controller';
import { UsersModule } from 'src/users/users.module';
import { AuthModule } from 'src/auth/auth.module';
import { ApiKeyModule } from 'src/api-key/api-key.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
    ApiKeyModule, // Imported to access ApiKey services
  ],
  controllers: [ExternalApiController],
})
export class ExternalApiModule {}
