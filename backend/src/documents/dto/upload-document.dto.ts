import { IsString, IsNotEmpty } from "class-validator"

export class UploadDocumentDto {
  @IsString()
  @IsNotEmpty()
  uploadedBy: string
}
