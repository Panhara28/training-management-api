import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

export class AssessmentAnswerDto {
  @ApiProperty()
  @IsInt()
  questionId!: number;

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
