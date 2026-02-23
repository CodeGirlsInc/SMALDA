import { PartialType } from '@nestjs/swagger';
import { CreateLandRecordDto } from './create-land-record.dto';

export class UpdateLandRecordDto extends PartialType(CreateLandRecordDto) {}
