import { IsString, Length } from 'class-validator';

export class LoginSmsDto {
  @IsString()
  @Length(6, 20)
  phone!: string;

  @IsString()
  @Length(4, 8)
  code!: string;
}
