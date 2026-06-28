import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/guards/roles.decorator';
import { OrganizationService } from './organization.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateOrganizationDto) {
    return this.organizationService.create(req.user.id, dto);
  }

  @Get()
  findByUser(@Request() req) {
    return this.organizationService.findByUser(req.user.id);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.organizationService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateOrganizationDto>) {
    return this.organizationService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  delete(@Param('id') id: string) {
    return this.organizationService.delete(id);
  }

  @Post(':id/members/invite')
  inviteMember(
    @Param('id') id: string,
    @Request() req,
    @Body() dto: InviteMemberDto,
  ) {
    return this.organizationService.inviteMember(id, req.user.id, dto);
  }

  @Post(':id/members/:membershipId/accept')
  acceptInvite(
    @Param('membershipId') membershipId: string,
    @Request() req,
  ) {
    return this.organizationService.acceptInvite(membershipId, req.user.id);
  }

  @Delete(':id/members/:membershipId')
  removeMember(
    @Param('id') _id: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.organizationService.removeMember(membershipId);
  }

  @Get(':id/members')
  getMembers(@Param('id') id: string) {
    return this.organizationService.getMembers(id);
  }
}
