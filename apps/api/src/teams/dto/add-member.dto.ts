import { IsOptional, IsString, Length } from 'class-validator';

export class AddMemberDto {
  @IsString()
  @Length(6, 20)
  phone!: string;

  @IsOptional()
  @IsString()
  role?: string;
}
