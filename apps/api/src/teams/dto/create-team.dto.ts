import { IsString, Length } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @Length(2, 32)
  name!: string;
}
