import { IsString, Length } from 'class-validator';

export class AdminBootstrapDto {
  @IsString()
  @Length(6, 200)
  token!: string;
}
