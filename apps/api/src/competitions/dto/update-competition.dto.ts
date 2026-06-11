import { IsISO8601, IsObject, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateCompetitionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  submissionStart?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  submissionEnd?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  judgingStart?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  judgingEnd?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  publicStart?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsISO8601()
  publicEnd?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsObject()
  config?: Record<string, unknown> | null;
}
