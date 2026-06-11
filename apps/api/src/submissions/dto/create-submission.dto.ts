import { SubmissionCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateSubmissionDto {
  @IsEnum(SubmissionCategory)
  category!: SubmissionCategory;

  @IsString()
  @Length(1, 80)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  intro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  aiToolsUsage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  teacherName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  teacherContact?: string;

  @IsOptional()
  @IsString()
  teamId?: string;
}

