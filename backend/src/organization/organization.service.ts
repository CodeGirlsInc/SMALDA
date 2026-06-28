import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationMember } from './entities/organization-member.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly memberRepository: Repository<OrganizationMember>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(userId: string, dto: CreateOrganizationDto): Promise<Organization> {
    const organization = this.organizationRepository.create({
      ...dto,
      ownerId: userId,
    });

    const savedOrg = await this.organizationRepository.save(organization);

    await this.memberRepository.save({
      organizationId: savedOrg.id,
      userId,
      role: 'admin',
      acceptedAt: new Date(),
    });

    return savedOrg;
  }

  async findById(id: string): Promise<Organization> {
    const organization = await this.organizationRepository.findOne({
      where: { id },
      relations: ['owner'],
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async findByUser(userId: string): Promise<Organization[]> {
    const memberships = await this.memberRepository.find({
      where: { userId },
      relations: ['organization'],
    });

    return memberships.map((membership) => membership.organization);
  }

  async update(id: string, dto: Partial<CreateOrganizationDto>): Promise<Organization> {
    const organization = await this.findById(id);
    Object.assign(organization, dto);
    return this.organizationRepository.save(organization);
  }

  async delete(id: string): Promise<void> {
    const organization = await this.findById(id);
    await this.organizationRepository.softRemove(organization);
  }

  async inviteMember(
    organizationId: string,
    invitedByUserId: string,
    dto: InviteMemberDto,
  ): Promise<OrganizationMember> {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException('User with this email not found');
    }

    const existingMembership = await this.memberRepository.findOne({
      where: { organizationId, userId: user.id },
    });

    if (existingMembership) {
      throw new BadRequestException('User is already a member of this organization');
    }

    const membership = this.memberRepository.create({
      organizationId,
      userId: user.id,
      role: dto.role ?? 'member',
      invitedById: invitedByUserId,
    });

    return this.memberRepository.save(membership);
  }

  async acceptInvite(membershipId: string, userId: string): Promise<OrganizationMember> {
    const membership = await this.memberRepository.findOne({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    if (membership.userId !== userId) {
      throw new BadRequestException('This invite is not for you');
    }

    if (membership.acceptedAt) {
      throw new BadRequestException('Invite already accepted');
    }

    membership.acceptedAt = new Date();
    return this.memberRepository.save(membership);
  }

  async removeMember(membershipId: string): Promise<void> {
    const membership = await this.memberRepository.findOne({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    await this.memberRepository.remove(membership);
  }

  async getMembers(organizationId: string): Promise<OrganizationMember[]> {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return this.memberRepository.find({
      where: { organizationId },
      relations: ['user', 'invitedBy'],
    });
  }

  async isMember(organizationId: string, userId: string): Promise<boolean> {
    const count = await this.memberRepository.count({
      where: { organizationId, userId },
    });

    return count > 0;
  }
}
