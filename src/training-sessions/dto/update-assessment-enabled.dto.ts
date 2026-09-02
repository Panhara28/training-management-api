import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateAssessmentEnabledDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}
