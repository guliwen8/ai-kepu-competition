import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class JudgeScoreDto {
  @IsInt()
  @Min(0)
  @Max(10)
  s1!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  s2!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  s3!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  s4!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  s5!: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
