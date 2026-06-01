import { Controller, Get, Patch, Param, Req, UseGuards, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Document } from '../../documents/entities/document.entity';
import { User } from '../../users/entities/user.entity';

@Controller('module/documents')
@UseGuards(JwtAuthGuard)
export class DocumentArchiveController {
  constructor(@InjectRepository(Document) private readonly docs: Repository<Document>) {}

  private async getOwned(id: string, userId: string) {
    const doc = await this.docs.findOneBy({ id });
    if (!doc) throw new NotFoundException();
    if (doc.ownerId !== userId) throw new ForbiddenException();
    return doc;
  }

  @Patch(':id/archive')
  async archive(@Param('id') id: string, @Req() req: { user: User }) {
    await this.getOwned(id, req.user.id);
    await this.docs.update(id, { archived: true });
    return this.docs.findOneByOrFail({ id });
  }

  @Patch(':id/unarchive')
  async unarchive(@Param('id') id: string, @Req() req: { user: User }) {
    await this.getOwned(id, req.user.id);
    await this.docs.update(id, { archived: false });
    return this.docs.findOneByOrFail({ id });
  }

  @Get('archived')
  async listArchived(@Req() req: { user: User }) {
    return this.docs.find({ where: { ownerId: req.user.id, archived: true }, order: { createdAt: 'DESC' } });
  }
}