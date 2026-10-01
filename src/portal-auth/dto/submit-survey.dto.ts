import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsUUID, IsOptional, IsString, ValidateNested } from 'class-validator';

export class SurveyAnswerDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  questionId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  rating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  textAnswer?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  choices?: number[];
}

export class SubmitSurveyDto {
  @ApiProperty({ type: [SurveyAnswerDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurveyAnswerDto)
  answers?: SurveyAnswerDto[];
}
