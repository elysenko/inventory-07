import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MovementType } from '@prisma/client';

/**
 * Shape rules are type-conditional:
 *   IN       — requires `toLocId`,   forbids `fromLocId`
 *   OUT      — requires `fromLocId`, forbids `toLocId`
 *   TRANSFER — requires both, and they must differ
 *
 * `@ValidateIf` covers the "required" half here so the pipe returns a 400 before
 * any DB work. The "forbidden" half and the from/to inequality are enforced in
 * MovementsService, which is the single place that also owns the balance
 * arithmetic — keeping one authority for what a legal movement is.
 */
export class CreateMovementDto {
  @ApiProperty({ enum: MovementType })
  @IsEnum(MovementType, { message: 'Type must be one of IN, OUT, TRANSFER' })
  type!: MovementType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Item is required' })
  itemId!: string;

  @ApiPropertyOptional({ description: 'Source location — OUT and TRANSFER' })
  @ValidateIf(
    (dto: CreateMovementDto) =>
      dto.type === MovementType.OUT || dto.type === MovementType.TRANSFER,
  )
  @IsString()
  @IsNotEmpty({ message: 'A source location is required for this movement' })
  fromLocId?: string;

  @ApiPropertyOptional({ description: 'Destination location — IN and TRANSFER' })
  @ValidateIf(
    (dto: CreateMovementDto) =>
      dto.type === MovementType.IN || dto.type === MovementType.TRANSFER,
  )
  @IsString()
  @IsNotEmpty({
    message: 'A destination location is required for this movement',
  })
  toLocId?: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'Quantity must be a whole number' })
  @Min(1, { message: 'Quantity must be at least 1' })
  qty!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
