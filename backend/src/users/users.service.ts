import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

@Injectable()
export class UsersService {
  private readonly rateLimitMap = new Map<string, RateLimitEntry>();
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 1000;
  private readonly RATE_LIMIT_MAX = 30;

  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  checkRateLimit(key: string): boolean {
    const now = Date.now();
    const entry = this.rateLimitMap.get(key);

    if (!entry || now - entry.windowStart > this.RATE_LIMIT_WINDOW_MS) {
      this.rateLimitMap.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= this.RATE_LIMIT_MAX) {
      return false;
    }

    entry.count += 1;
    return true;
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    await this.userRepository.update(id, updates);
    return this.findById(id);
  }

  async changeEmail(
    id: string,
    newEmail: string,
  ): Promise<User | null> {
    const existing = await this.findByEmail(newEmail);
    if (existing && existing.id !== id) {
      return null;
    }

    await this.userRepository.update(id, {
      email: newEmail,
      isVerified: false,
    });
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.userRepository.softDelete(id);
  }

  async findAllPaginated(
    page = 1,
    limit = 20,
    search?: string,
    role?: UserRole,
  ): Promise<{ data: User[]; total: number; page: number; limit: number }> {
    const where: FindOptionsWhere<User> = {};
    if (role) where.role = role;
    if (search?.trim()) where.fullName = ILike(`%${search.trim()}%`);

    const [data, total] = await this.userRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  countAdmins(): Promise<number> {
    return this.userRepository.count({ where: { role: UserRole.ADMIN } });
  }

  async updateRole(id: string, role: UserRole): Promise<User | null> {
    await this.userRepository.update(id, { role });
    return this.findById(id);
  }
}
