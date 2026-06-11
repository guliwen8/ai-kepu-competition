import { IsString, MinLength } from 'class-validator';

export class LoginPasswordDto {
  @IsString()
  identity!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

