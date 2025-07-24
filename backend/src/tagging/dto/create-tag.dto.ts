import { IsString, IsNotEmpty, MaxLength } from "class-validator"
import { ApiProperty } from "@nestjs/swagger"

export class CreateTagDto {
  @ApiProperty({ description: "Name of the tag", maxLength: 100 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string
}
