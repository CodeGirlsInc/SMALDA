import { WinstonModuleOptions } from 'nest-winston';
import { format, transports } from 'winston';

const baseFormat = format.combine(format.timestamp(), format.errors({ stack: true }), format.json());

export function buildWinstonOptions(level?: string): WinstonModuleOptions {
  return {
    level: level || process.env.LOG_LEVEL || 'info',
    format: baseFormat,
    transports: [new transports.Console()],
  };
}
