import { ArrayMinSize, IsArray, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateWebhookDto {
  @IsUrl()
  url: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  events: string[];

  @IsOptional()
  @IsString()
  secret?: string;
}
