import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SettingValueDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  key!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  value!: string;
}

export class UpdateSettingsDto {
  @ApiProperty({ type: [SettingValueDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SettingValueDto)
  settings!: SettingValueDto[];
}
