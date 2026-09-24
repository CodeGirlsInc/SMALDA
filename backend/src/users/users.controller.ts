import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { DocumentsService } from '../documents/documents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from './entities/user.entity';

/**
 * Self-service data export for GDPR-style portability requests.
 * Returns the caller's own profile and document metadata, with
 * secrets (password hash, 2FA material) and internal file paths
 * excluded from the payload.
 */
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly documentsService: DocumentsService,
  ) {}

  @Get('me/export')
  @UseGuards(JwtAuthGuard)
  async exportMyData(@Req() req: Request & { user?: User }) {
    const userId = req.user!.id;
    const [user, documents] = await Promise.all([
      this.usersService.findById(userId),
      this.documentsService.findByOwner(userId),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      user: {
        id: user?.id,
        email: user?.email,
        fullName: user?.fullName,
        role: user?.role,
        isVerified: user?.isVerified,
        preferredLanguage: user?.preferredLanguage,
        twoFactorEnabled: user?.twoFactorEnabled,
        createdAt: user?.createdAt,
        updatedAt: user?.updatedAt,
      },
      documents: (documents ?? []).map((doc) => ({
        id: doc.id,
        title: doc.title,
        status: doc.status,
        riskScore: doc.riskScore,
        riskFlags: doc.riskFlags,
        fileSize: doc.fileSize,
        mimeType: doc.mimeType,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      })),
    };
  }
}