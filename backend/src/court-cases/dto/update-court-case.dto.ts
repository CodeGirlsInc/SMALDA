import { PartialType } from '@nestjs/mapped-types';
import { CreateCourtCaseDto } from './create-court-case.dto';

export class UpdateCourtCaseDto extends PartialType(CreateCourtCaseDto) {}
