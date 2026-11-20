import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

import { isAllowedFrontendOrigin } from '../cors.config';

export class ConfigurableIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly configService: ConfigService,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const serverOptions: ServerOptions = {
      ...options,
      cors: {
        ...(typeof options?.cors === 'object' ? options.cors : {}),
        credentials: true,
        origin: (origin, callback) => {
          if (!origin || isAllowedFrontendOrigin(this.configService, origin)) {
            callback(null, true);
            return;
          }
          callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
        },
      },
    };

    return super.createIOServer(port, serverOptions);
  }
}
