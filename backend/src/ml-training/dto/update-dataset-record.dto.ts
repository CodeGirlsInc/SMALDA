import { PartialType } from "@nestjs/mapped-types"
import { CreateDatasetRecordDto } from "./create-dataset-record.dto"

export class UpdateDatasetRecordDto extends PartialType(CreateDatasetRecordDto) {}
