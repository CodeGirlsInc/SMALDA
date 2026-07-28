import { ApiProperty } from '@nestjs/swagger';

export class PaginatedResponseMeta {
  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  total: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasNext: boolean;

  @ApiProperty()
  hasPrev: boolean;
}

export class PaginatedResponse<T> {
  @ApiProperty({ isArray: true })
  data: T[];

  @ApiProperty({ type: PaginatedResponseMeta })
  meta: PaginatedResponseMeta;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.meta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    };
  }
}
