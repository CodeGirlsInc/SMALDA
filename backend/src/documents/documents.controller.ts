import { Controller, Get, Post, Param, Delete, UseInterceptors, Res, Query, ParseUUIDPipe } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import type { Response } from "express"
import type { DocumentsService } from "./documents.service"
import type { UploadDocumentDto } from "./dto/upload-document.dto"
import type { Document } from "./entities/document.entity"
import type { Express } from "express"
import { AuditInterceptor } from "../audit-log/interceptors/audit.interceptor"

@Controller("documents")
@UseInterceptors(AuditInterceptor)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async uploadDocument(file: Express.Multer.File, uploadDocumentDto: UploadDocumentDto): Promise<Document> {
    return await this.documentsService.uploadDocument(file, uploadDocumentDto)
  }

  @Get()
  async findAll(@Query('uploadedBy') uploadedBy?: string): Promise<Document[]> {
    if (uploadedBy) {
      return await this.documentsService.findByUploadedBy(uploadedBy);
    }
    return await this.documentsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Document> {
    return await this.documentsService.findOne(id);
  }

  @Get(":id/download")
  async downloadDocument(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const { buffer, document } = await this.documentsService.getFileBuffer(id)

    res.set({
      "Content-Type": document.mimeType,
      "Content-Disposition": `attachment; filename="${document.originalName}"`,
      "Content-Length": document.size.toString(),
    })

    res.send(buffer)
  }

  @Get(":id/view")
  async viewDocument(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response): Promise<void> {
    const { buffer, document } = await this.documentsService.getFileBuffer(id)

    res.set({
      "Content-Type": document.mimeType,
      "Content-Length": document.size.toString(),
    })

    res.send(buffer)
  }

  @Delete(':id')
  async deleteDocument(@Param('id', ParseUUIDPipe) id: string): Promise<{ message: string }> {
    await this.documentsService.deleteDocument(id);
    return { message: 'Document deleted successfully' };
  }
}
