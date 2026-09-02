import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  programId!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  venue!: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsString()
  @IsNotEmpty()
  startDate!: string;

  @ApiProperty({ example: '2026-01-03' })
  @IsString()
  @IsNotEmpty()
  endDate!: string;

  @ApiProperty({ example: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxCapacity!: number;
}
