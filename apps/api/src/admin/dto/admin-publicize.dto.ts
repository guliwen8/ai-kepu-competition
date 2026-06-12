import { IsArray, IsBoolean, IsString } from 'class-validator';

export class AdminPublicizeDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsBoolean()
  enabled!: boolean;
}
