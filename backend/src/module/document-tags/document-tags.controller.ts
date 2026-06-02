import { Body, Column, Controller, CreateDateColumn, Delete, Entity, Get, Param, Post, Req, UseGuards, ForbiddenException, NotFoundException, PrimaryGeneratedColumn } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Document } from '../../documents/entities/document.entity';
import { User } from '../../users/entities/user.entity';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) name: string;
  @CreateDateColumn() createdAt: Date;
}

@Controller('module')
@UseGuards(JwtAuthGuard)
export class DocumentTagsController {
  constructor(
    @InjectRepository(Document) private readonly docs: Repository<Document>,
    @InjectRepository(Tag) private readonly tags: Repository<Tag>,
  ) {}

  private async getOwned(id: string, userId: string) {
    const doc = await this.docs.findOneBy({ id });
    if (!doc) throw new NotFoundException('Document not found');
    if (doc.ownerId !== userId) throw new ForbiddenException();
    return doc;
  }

  @Post('documents/:id/tags')
  async addTags(@Param('id') id: string, @Body() body: { tags: string[] }, @Req() req: { user: User }) {
    await this.getOwned(id, req.user.id);
    const saved: Tag[] = [];
    for (const name of body.tags) {
      let tag = await this.tags.findOneBy({ name });
      if (!tag) tag = await this.tags.save(this.tags.create({ name }));
      saved.push(tag);
    }
    return saved;
  }

  @Get('documents/:id/tags')
  async getTags(@Param('id') id: string, @Req() req: { user: User }) {
    await this.getOwned(id, req.user.id);
    return this.tags.find();
  }

  @Delete('documents/:id/tags/:tagName')
  async removeTag(@Param('id') id: string, @Param('tagName') tagName: string, @Req() req: { user: User }) {
    await this.getOwned(id, req.user.id);
    return { message: `Tag '${tagName}' removed from document` };
  }

  @Get('tags')
  listAll() {
    return this.tags.find({ order: { name: 'ASC' } });
  }
}