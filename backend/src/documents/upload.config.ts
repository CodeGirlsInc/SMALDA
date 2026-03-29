import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { Request } from 'express';
import { FileTypeResult, fromBuffer } from 'file-type';

// ─── Allowed extensions & their expected MIME types ──────────────────────────
const ALLOWED: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

// ─── Upload directory (outside web root) ─────────────────────────────────────
export const UPLOAD_DIR = path.resolve(process.cwd(), 'private-uploads');

// Ensure the directory exists at startup
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ─── Multer storage: UUID-based filenames, no original filename exposed ───────
import { diskStorage } from 'multer';

export const secureStorage = diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

// ─── Multer file filter: extension + declared MIME whitelist ─────────────────
export const fileFilter: MulterOptions['fileFilter'] = (
  _req,
  file,
  cb,
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMime = ALLOWED[ext];

  if (!allowedMime) {
    return cb(
      new BadRequestException(
        `File extension "${ext}" is not allowed. Allowed: ${Object.keys(ALLOWED).join(', ')}`,
      ),
      false,
    );
  }

  if (file.mimetype !== allowedMime) {
    return cb(
      new BadRequestException(
        `MIME type "${file.mimetype}" does not match extension "${ext}"`,
      ),
      false,
    );
  }

  cb(null, true);
};

// ─── Magic-bytes interceptor: verifies actual file content after upload ───────
@Injectable()
export class MagicBytesInterceptor implements NestInterceptor {
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest<Request>();
    const file = (req as any).file as Express.Multer.File | undefined;

    if (file) {
      await this.validateMagicBytes(file);
    }

    // Also handle multiple files
    const files: Express.Multer.File[] = (req as any).files ?? [];
    for (const f of files) {
      await this.validateMagicBytes(f);
    }

    return next.handle();
  }

  private async validateMagicBytes(file: Express.Multer.File): Promise<void> {
    // Read first 4100 bytes (enough for file-type detection)
    const buffer = file.buffer
      ? file.buffer.slice(0, 4100)
      : fs.readFileSync(file.path).slice(0, 4100);

    let detected: FileTypeResult | undefined;
    try {
      detected = await fromBuffer(buffer);
    } catch {
      // file-type couldn't determine type — reject
    }

    if (!detected) {
      this.cleanUp(file);
      throw new BadRequestException(
        'Could not determine file type from content. Upload rejected.',
      );
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const expectedMime = ALLOWED[ext];

    if (detected.mime !== expectedMime) {
      this.cleanUp(file);
      throw new BadRequestException(
        `File content does not match declared type. Expected "${expectedMime}", detected "${detected.mime}".`,
      );
    }
  }

  private cleanUp(file: Express.Multer.File): void {
    if (file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        // best-effort cleanup
      }
    }
  }
}