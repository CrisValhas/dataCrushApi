import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateApiTokenDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];
}
