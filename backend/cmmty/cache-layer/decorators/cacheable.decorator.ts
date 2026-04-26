import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to mark a controller method as cacheable.
 * @param key - The cache key or a function that generates it from request
 * @param ttl - Time to live in seconds (default: 60)
 * 
 * Example usage:
 * @Cacheable('all-documents', 120)
 * or with a key generator:
 * @Cacheable((req) => `documents:user:${req.user.id}`)
 */
export const Cacheable = (
  key: string | ((req: any) => string),
  ttl: number = 60,
) => {
  return SetMetadata('cacheable', { key, ttl });
};
