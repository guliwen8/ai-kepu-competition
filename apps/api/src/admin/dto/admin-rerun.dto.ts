import { ReviewTaskType } from '@prisma/client';
import { ArrayNotEmpty, IsArray, IsEnum } from 'class-validator';

export class AdminRerunDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ReviewTaskType, { each: true })
  types!: ReviewTaskType[];
}
