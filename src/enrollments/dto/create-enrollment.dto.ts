import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateEnrollmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sessionId!: string;
}
