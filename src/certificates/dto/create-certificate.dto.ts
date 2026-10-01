import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateCertificateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sessionId!: string;
}
