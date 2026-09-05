import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MovementType } from '@prisma/client';

export class QueryMovementsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  itemId?: string;

  @ApiPropertyOptional({ enum: MovementType })
  @IsOptional()
  @IsEnum(MovementType)
  type?: MovementType;

  @ApiPropertyOptional({ description: 'Inclusive lower bound, ISO-8601' })
  @IsOptional()
  @IsISO8601({}, { message: 'From must be a date' })
  from?: string;

  @ApiPropertyOptional({ description: 'Inclusive upper bound, ISO-8601' })
  @IsOptional()
  @IsISO8601({}, { message: 'To must be a date' })
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
