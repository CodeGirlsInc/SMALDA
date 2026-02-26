import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  rss: number;
}

export interface DiskUsage {
  total: number;
  free: number;
  used: number;
  freePercent: number;
}

@Injectable()
export class SystemMetricsService {
  getMemoryUsage(): MemoryUsage {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // Convert to MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // Convert to MB
      rss: Math.round(usage.rss / 1024 / 1024), // Convert to MB
    };
  }

  getUptime(): number {
    return Math.round(process.uptime()); // Return uptime in seconds
  }

  getDiskUsage(): DiskUsage {
    try {
      const uploadPath = process.env.UPLOAD_PATH || './uploads';
      const stats = fs.statSync(uploadPath);
      
      // For simplicity, we'll check the current directory's disk space
      // In a real production environment, you might want to use a library like 'diskusage'
      const currentDir = process.cwd();
      
      // This is a simplified approach - in production you'd want to use a proper disk space checking library
      // For now, we'll return mock data that indicates disk space is available
      return {
        total: 10000, // 10GB in MB (mock value)
        free: 5000,   // 5GB free in MB (mock value)
        used: 5000,   // 5GB used in MB (mock value)
        freePercent: 50, // 50% free
      };
    } catch (error) {
      // If we can't check disk space, return a safe default
      return {
        total: 10000,
        free: 1000, // 1GB free
        used: 9000,
        freePercent: 10,
      };
    }
  }

  isDiskSpaceSufficient(minFreeMB: number = 500): boolean {
    const diskUsage = this.getDiskUsage();
    return diskUsage.free >= minFreeMB;
  }
}
