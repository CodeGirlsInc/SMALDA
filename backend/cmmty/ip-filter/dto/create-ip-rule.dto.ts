import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IpRuleType } from '../entities/ip-rule.entity';

export class CreateIpRuleDto {
  @IsString()
  @IsNotEmpty()
  cidr: string;

  @IsEnum(IpRuleType)
  @IsNotEmpty()
  type: IpRuleType;

  @IsString()
  @IsOptional()
  reason?: string;
}
