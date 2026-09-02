import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt } from 'class-validator';

export class CreateEnrollmentDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  userId!: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  sessionId!: number;
}
