import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateSubmissionDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  title?: string;

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
}
