import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional } from 'class-validator';
import { EnrollmentStatus } from '@prisma/client';

export class UpdateEnrollmentDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  id!: number;

  @ApiProperty({ enum: EnrollmentStatus })
  @IsIn(Object.values(EnrollmentStatus))
  status!: EnrollmentStatus;

  @ApiPropertyOptional({ example: 85 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  score?: number;
}
