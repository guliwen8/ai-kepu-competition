import { IsOptional, IsString, Length, MinLength } from 'class-validator';

export class RegisterDto {
  @IsOptional()
  @IsString()
  @Length(3, 32)
  username?: string;

  @IsOptional()
  @IsString()
  @Length(6, 20)
  phone?: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

