import { Controller, Get, Param, Patch, Body, Req, UseGuards, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { User, UserRole } from '../../users/entities/user.entity';

const TERMINAL = new Set(['RESOLVED', 'REJECTED']);
const disputes = new Map<string, Record<string, unknown>>();

@Controller('module/disputes')
@UseGuards(JwtAuthGuard)
export class DisputeStatusController {
  @Get()
  list(@Req() req: { user: User }) {
    return [...disputes.values()].filter((d) => d['submittedBy'] === req.user.id);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: { user: User }) {
    const d = disputes.get(id);
    if (!d) throw new NotFoundException();
    if (d['submittedBy'] !== req.user.id && req.user.role !== UserRole.ADMIN) throw new ForbiddenException();
    return d;
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }, @Req() req: { user: User }) {
    if (req.user.role !== UserRole.ADMIN) throw new ForbiddenException();
    const d = disputes.get(id);
    if (!d) throw new NotFoundException();
    if (TERMINAL.has(d['status'] as string)) throw new ConflictException('Dispute is in a terminal state');
    d['status'] = body.status;
    return d;
  }
}