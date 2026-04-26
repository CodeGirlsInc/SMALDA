import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
// Assuming a generic repository pattern or ORM
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private auditService: AuditService,
  ) {}

  async changeRole(targetUserId: string, newRole: string, adminId: string) {
    const user = await this.usersRepository.findOne({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('User not found');
    
    const oldRole = user.role;
    user.role = newRole;
    await this.usersRepository.save(user);

    // Role change is logged via AuditService
    await this.auditService.logRoleChange({
      adminId,
      targetUserId,
      oldRole,
      newRole,
    });

    return user;
  }

  async verifyUser(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    user.isVerified = true;
    return this.usersRepository.save(user);
  }

  async suspendUser(id: string) {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    user.isSuspended = true;
    return this.usersRepository.save(user);
  }
}
