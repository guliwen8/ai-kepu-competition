import { IsOptional, IsString } from 'class-validator';

export class AdminGrantJudgeDto {
  @IsString()
  phone!: string;

  @IsString()
  realName!: string;

  @IsOptional()
  @IsString()
  orgName?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  contact?: string;
}
