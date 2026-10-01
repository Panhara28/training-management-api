import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsUUID, IsNumber, IsOptional } from 'class-validator';
import { EnrollmentStatus } from '@prisma/client';

export class UpdateEnrollmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ enum: EnrollmentStatus })
  @IsIn(Object.values(EnrollmentStatus))
  status!: EnrollmentStatus;

  @ApiPropertyOptional({ example: 85 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  score?: number;
}
