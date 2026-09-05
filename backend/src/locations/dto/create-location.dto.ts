import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateLocationDto {
  @ApiProperty({ example: 'Rack 1' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'Zone A' })
  @IsString()
  @IsNotEmpty({ message: 'Zone is required' })
  @MaxLength(120)
  zone!: string;
}
