import { IsISO8601, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateCompetitionDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  @IsISO8601()
  submissionStart?: string;

  @IsOptional()
  @IsISO8601()
  submissionEnd?: string;

  @IsOptional()
  @IsISO8601()
  judgingStart?: string;

  @IsOptional()
  @IsISO8601()
  judgingEnd?: string;

  @IsOptional()
  @IsISO8601()
  publicStart?: string;

  @IsOptional()
  @IsISO8601()
  publicEnd?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
