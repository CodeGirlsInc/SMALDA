import * as fs from 'fs';
import * as path from 'path';
import { PaginationQueryDto } from './common/dto/pagination.dto';

describe('kike-alt Features (BE-144, BE-143, BE-142, BE-141)', () => {
  it('PaginationQueryDto sets default page and limit', () => {
    const dto = new PaginationQueryDto();
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('docker-compose.yml and DEPLOYMENT.md exist', () => {
    expect(
      fs.existsSync(path.resolve(__dirname, '../../docker-compose.yml')),
    ).toBe(true);
    expect(
      fs.existsSync(path.resolve(__dirname, '../../docs/DEPLOYMENT.md')),
    ).toBe(true);
  });
});
