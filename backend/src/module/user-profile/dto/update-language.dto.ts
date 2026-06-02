import { IsIn } from 'class-validator';

export class UpdateLanguageDto {
  @IsIn(['en', 'fr'])
  languageCode: string;
}
