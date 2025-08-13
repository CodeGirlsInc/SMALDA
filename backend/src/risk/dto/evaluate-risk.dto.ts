import { IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PartyDto {
  @IsString()
  name: string;

  @IsString()
  @IsIn(['buyer', 'seller', 'witness', 'agent', 'lawyer', 'unknown'])
  role: string;
}

export class CourtCaseDto {
  @IsString()
  @IsOptional()
  caseType?: string;

  @IsString()
  @IsIn(['pending', 'active', 'closed', 'appealed'])
  status: string;

  @IsOptional()
  @IsDateString()
  filedAt?: string;

  @IsOptional()
  @IsString()
  outcome?: string;
}

export class EncumbranceDto {
  @IsString()
  type: string; // lien, mortgage, caveat, easement, etc.

  @IsOptional()
  @IsString()
  details?: string;
}

export class PropertyDto {
  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  sizeSqm?: number;

  @IsOptional()
  @IsString()
  titleStatus?: string; // clear, provisional, disputed

  @IsOptional()
  @IsBoolean()
  surveyMismatch?: boolean;

  @IsOptional()
  @IsBoolean()
  overlappingClaims?: boolean;
}

export class HistoryDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  transactions?: Array<Record<string, any>>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  disputes?: Array<Record<string, any>>;
}

export class EvaluateRiskDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartyDto)
  parties: PartyDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourtCaseDto)
  courtCases?: CourtCaseDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EncumbranceDto)
  encumbrances?: EncumbranceDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PropertyDto)
  property?: PropertyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => HistoryDto)
  history?: HistoryDto;

  @IsOptional()
  @IsObject()
  extra?: Record<string, any>;
}
