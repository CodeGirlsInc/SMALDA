import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CursorPaginationQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export interface CursorPaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CursorPaginationOptions {
  cursorField?: string;
  orderBy?: 'ASC' | 'DESC';
}

export class CursorPaginationHelper {
  /**
   * Decode cursor from base64
   */
  static decodeCursor(cursor: string): { id: string; createdAt: Date } | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      return {
        id: parsed.id,
        createdAt: new Date(parsed.createdAt),
      };
    } catch {
      return null;
    }
  }

  /**
   * Encode cursor to base64
   */
  static encodeCursor(id: string, createdAt: Date): string {
    const data = JSON.stringify({ id, createdAt: createdAt.toISOString() });
    return Buffer.from(data).toString('base64');
  }

  /**
   * Apply cursor pagination to a query builder
   */
  static applyCursorPagination<T>(
    queryBuilder: any,
    cursor: string | undefined,
    limit: number,
    options: CursorPaginationOptions = {},
  ): any {
    const { cursorField = 'id', orderBy = 'DESC' } = options;

    if (cursor) {
      const decoded = this.decodeCursor(cursor);
      if (decoded) {
        const comparisonOperator = orderBy === 'DESC' ? '<' : '>';
        queryBuilder.andWhere(
          `document.${cursorField} ${comparisonOperator} :cursorValue OR (document.${cursorField} = :cursorValue AND document.createdAt ${comparisonOperator} :createdAt)`,
          {
            cursorValue: decoded.id,
            createdAt: decoded.createdAt,
          },
        );
      }
    }

    // Fetch one extra to determine if there are more results
    queryBuilder.take(limit + 1).orderBy(`document.${cursorField}`, orderBy).addOrderBy('document.createdAt', orderBy);

    return queryBuilder;
  }

  /**
   * Determine if there are more results and get the next cursor
   */
  static processResults<T>(results: T[], limit: number): CursorPaginatedResult<T> {
    const hasMore = results.length > limit;
    const data = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore && data.length > 0 ? this.extractCursor(data[data.length - 1]) : null;

    return {
      data,
      nextCursor,
      hasMore,
    };
  }

  private static extractCursor(item: any): string | null {
    if (item.id && item.createdAt) {
      return this.encodeCursor(item.id, new Date(item.createdAt));
    }
    return null;
  }
}