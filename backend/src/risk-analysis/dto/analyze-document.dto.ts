import { IsString, IsNotEmpty, IsOptional, IsEnum } from "class-validator"

export enum AnalysisMethod {
  STATIC_RULES = "STATIC_RULES",
  AI_ANALYSIS = "AI_ANALYSIS",
  HYBRID = "HYBRID",
}

export class AnalyzeDocumentDto {
  @IsString()
  @IsNotEmpty()
  documentId: string

  @IsString()
  @IsNotEmpty()
  analyzedBy: string

  @IsOptional()
  @IsEnum(AnalysisMethod)
  analysisMethod?: AnalysisMethod = AnalysisMethod.STATIC_RULES
}
