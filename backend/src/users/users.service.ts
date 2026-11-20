import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  FindOptionsWhere,
  ILike,
  In,
  IsNull,
  Repository,
} from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { ApiKey } from './entities/api-key.entity';
import { RefreshSession } from '../auth/entities/refresh-session.entity';
import { Dispute } from '../dispute/entities/dispute.entity';

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

  async getNotificationPreferences(
    id: string,
  ): Promise<Record<string, { email: boolean; inApp: boolean }>> {
    const user = await this.findById(id);
    const stored = user?.notificationPreferences ?? {};
    const out: Record<string, { email: boolean; inApp: boolean }> = {};
    for (const key of ['risk_alert', 'verification_complete', 'dispute_update']) {
      out[key] = {
        email: stored[key]?.email ?? true,
        inApp: stored[key]?.inApp ?? true,
      };
    }
    return out;
  }

  async updateNotificationPreferences(
    id: string,
    patch: Record<string, { email?: boolean; inApp?: boolean } | undefined>,
  ): Promise<Record<string, { email: boolean; inApp: boolean }>> {
    const current = await this.getNotificationPreferences(id);
    for (const [key, channels] of Object.entries(patch)) {
      if (!channels) continue;
      current[key] = {
        email: channels.email ?? current[key]?.email ?? true,
        inApp: channels.inApp ?? current[key]?.inApp ?? true,
      };
    }
    await this.userRepository.update(id, { notificationPreferences: current });
    return current;
  }

  /**
   * Soft-delete the account and make it unusable: refresh sessions and API
   * keys are revoked, and the email is anonymised so the unique `email` column
   * no longer blocks registering the same address again (#1608). Access tokens
   * stop resolving because `findById` hides soft-deleted rows.
   */
  async softDelete(id: string): Promise<void> {
    await this.userRepository.manager.transaction(async (manager) => {
      await this.revokeCredentials(manager, id);
      await manager.getRepository(User).update(id, {
        email: `deleted+${id}@invalid`,
      });
      await manager.getRepository(User).softDelete(id);
    });
  }

  /** True when `password` matches the stored hash (false for password-less accounts). */
  async verifyPassword(id: string, password: string): Promise<boolean> {
    const user = await this.findById(id);
    if (!user?.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

  /**
   * Erase the user's data rows in one transaction: disputes filed by the user
   * or against their documents, sessions and API keys, then the account itself
   * (anonymised and soft-deleted). Documents and their files are removed by the
   * caller through `DocumentsService.delete` first.
   */
  async eraseUserData(id: string, documentIds: string[]): Promise<void> {
    await this.userRepository.manager.transaction(async (manager) => {
      const disputes = manager.getRepository(Dispute);
      await disputes.delete({ filedBy: id });
      if (documentIds.length > 0) {
        await disputes.delete({ documentId: In(documentIds) });
      }
      await this.revokeCredentials(manager, id);
      await manager.getRepository(User).update(id, {
        email: `deleted+${id}@invalid`,
        fullName: 'Deleted user',
        passwordHash: null,
        twoFactorSecret: undefined,
        twoFactorBackupCodes: undefined,
        twoFactorEnabled: false,
        notificationPreferences: {},
      });
      await manager.getRepository(User).softDelete(id);
    });
  }

  private async revokeCredentials(manager: EntityManager, userId: string) {
    const now = new Date();
    await manager
      .getRepository(RefreshSession)
      .update({ userId, revokedAt: IsNull() }, { revokedAt: now });
    await manager
      .getRepository(ApiKey)
      .update({ userId, revokedAt: IsNull() }, { revokedAt: now });
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

  async updateRolePreservingLastAdmin(
    id: string,
    role: UserRole,
  ): Promise<boolean> {
    return this.userRepository.manager.transaction(async (manager) => {
      const admins = await this.getLockedAdmins(manager);
      if (admins.length <= 1) return false;

      const result = await manager
        .getRepository(User)
        .createQueryBuilder()
        .update(User)
        .set({ role })
        .where('id = :id', { id })
        .andWhere('role = :adminRole', { adminRole: UserRole.ADMIN })
        .andWhere('deleted_at IS NULL')
        .execute();

      return (result.affected ?? 0) > 0;
    });
  }

  async softDeletePreservingLastAdmin(id: string): Promise<boolean> {
    return this.userRepository.manager.transaction(async (manager) => {
      const admins = await this.getLockedAdmins(manager);
      if (admins.length <= 1) return false;

      const result = await manager
        .getRepository(User)
        .createQueryBuilder()
        .softDelete()
        .from(User)
        .where('id = :id', { id })
        .andWhere('role = :adminRole', { adminRole: UserRole.ADMIN })
        .andWhere('deleted_at IS NULL')
        .execute();

      return (result.affected ?? 0) > 0;
    });
  }

  async updateRole(id: string, role: UserRole): Promise<User | null> {
    await this.userRepository.update(id, { role });
    return this.findById(id);
  }

  private getLockedAdmins(manager: EntityManager): Promise<User[]> {
    return manager
      .getRepository(User)
      .createQueryBuilder('user')
      .select('user.id')
      .where('user.role = :adminRole', { adminRole: UserRole.ADMIN })
      .andWhere('user.deleted_at IS NULL')
      .orderBy('user.id', 'ASC')
      .setLock('pessimistic_write')
      .getMany();
  }
}
