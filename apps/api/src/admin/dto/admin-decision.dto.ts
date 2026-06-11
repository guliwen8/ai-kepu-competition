import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum AdminDecision {
  APPROVE = 'APPROVE',
  NEED_FIX = 'NEED_FIX',
  REJECT = 'REJECT',
}

export class AdminDecisionDto {
  @IsEnum(AdminDecision)
  decision!: AdminDecision;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

