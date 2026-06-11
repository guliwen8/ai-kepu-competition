import { ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class AdminAssignBatchDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  submissionIds!: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  judgeIds!: string[];

  @IsOptional()
  @IsIn(['cross'])
  mode?: 'cross';

  @IsOptional()
  @IsBoolean()
  ensureBlindCode?: boolean;
}

