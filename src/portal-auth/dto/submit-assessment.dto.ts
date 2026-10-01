import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsUUID, IsOptional, IsString, ValidateNested } from 'class-validator';

export class AssessmentAnswerDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  questionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chosenOption?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  textAnswer?: string;
}

export class SubmitAssessmentDto {
  @ApiProperty({ type: [AssessmentAnswerDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssessmentAnswerDto)
  answers?: AssessmentAnswerDto[];
}
