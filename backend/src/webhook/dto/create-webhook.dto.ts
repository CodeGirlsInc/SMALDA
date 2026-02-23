import {
  IsArray,
  IsNotEmpty,
  IsString,
  IsUrl,
  ArrayNotEmpty,
} from 'class-validator';

export class CreateWebhookDto {
  @IsUrl({ require_protocol: true })
  url: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  events: string[];
}