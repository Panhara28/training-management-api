import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class AssignTrainersDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @IsUUID('all', { each: true })
  userIds!: string[];
}
