import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import checkDiskSpace from 'check-disk-space';

@Injectable()
export class DiskHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async checkDiskSpace(key: string) {
    const indicator = this.healthIndicatorService.check(key);
    const path = process.platform === 'win32' ? 'C:\\' : '/';
    const diskSpace = await checkDiskSpace(path);
    const freeMb = Math.floor(diskSpace.free / 1024 / 1024);

    if (freeMb < 500) {
      return indicator.down({
        path,
        freeMb,
        requiredFreeMb: 500,
      });
    }

    return indicator.up({
      path,
      freeMb,
      requiredFreeMb: 500,
    });
  }
}
