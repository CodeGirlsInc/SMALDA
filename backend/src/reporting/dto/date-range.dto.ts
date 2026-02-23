import {
  IsOptional,
  IsISO8601,
} from 'class-validator';

export class DateRangeDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  resolve(): { from: Date; to: Date } {
    const now = new Date();

    const toDate = this.to ? new Date(this.to) : now;

    const fromDate = this.from
      ? new Date(this.from)
      : new Date(
          toDate.getFullYear(),
          toDate.getMonth(),
          toDate.getDate() - 30,
        );

    if (fromDate > toDate) {
      throw new Error('from must be before or equal to to');
    }

    return {
      from: fromDate,
      to: toDate,
    };
  }
}