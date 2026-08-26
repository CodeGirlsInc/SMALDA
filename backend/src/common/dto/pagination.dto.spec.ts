import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaginationQueryDto } from './pagination.dto';

describe('PaginationQueryDto', () => {
  it('should accept valid pagination params', async () => {
    const dto = plainToInstance(PaginationQueryDto, {
      page: 1,
      limit: 20,
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept limit at max (100)', async () => {
    const dto = plainToInstance(PaginationQueryDto, { limit: 100 });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject limit above max (100)', async () => {
    const dto = plainToInstance(PaginationQueryDto, { limit: 1000 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    const limitErrors = errors.filter((e) => e.property === 'limit');
    expect(limitErrors.length).toBeGreaterThan(0);
  });

  it('should reject page less than 1', async () => {
    const dto = plainToInstance(PaginationQueryDto, { page: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should use defaults when no params provided', () => {
    const dto = plainToInstance(PaginationQueryDto, {});
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.sortOrder).toBe('DESC');
  });
});
