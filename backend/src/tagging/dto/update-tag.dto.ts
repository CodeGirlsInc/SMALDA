import { PartialType } from "@nestjs/swagger"
import { CreateTagDto } from "./create-tag.dto"
import { IsOptional, IsString, MaxLength } from "class-validator"
import { ApiProperty } from "@nestjs/swagger"

export class UpdateTagDto extends PartialType(CreateTagDto) {
  @ApiProperty({ description: "Updated name of the tag", required: false, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string
}
