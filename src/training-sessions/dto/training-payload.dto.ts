import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class AgendaItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  day!: number;

  @ApiProperty({ example: '09:00' })
  @IsString()
  timeFrom!: string;

  @ApiProperty({ example: '10:00' })
  @IsString()
  timeTo!: string;

  @ApiProperty({ example: 'Opening remarks' })
  @IsString()
  topic!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  facilitator?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class MaterialDto {
  @ApiProperty({ enum: ['file', 'link', 'video'] })
  @IsIn(['file', 'link', 'video'])
  type!: 'file' | 'link' | 'video';

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  value?: string;
}

export class OptionDto {
  @ApiProperty()
  @IsString()
  text!: string;
}

export class QuestionDto {
  @ApiProperty({ enum: ['multiple_choice', 'true_false', 'short_answer'] })
  @IsIn(['multiple_choice', 'true_false', 'short_answer'])
  type!: 'multiple_choice' | 'true_false' | 'short_answer';

  @ApiProperty()
  @IsString()
  text!: string;

  @ApiPropertyOptional({ type: [OptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options?: OptionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correctOption?: string | null;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  points!: number;
}

export class AssessmentDto {
  @ApiProperty({ enum: ['pre', 'post', 'exam'] })
  @IsIn(['pre', 'post', 'exam'])
  category!: 'pre' | 'post' | 'exam';

  @ApiProperty({ example: 70 })
  @IsInt()
  @Min(0)
  passScore!: number;

  @ApiPropertyOptional({ type: [QuestionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions?: QuestionDto[];
}

export class SurveyQuestionDto {
  @ApiProperty({ enum: ['rating', 'single_choice', 'multiple_choice', 'open_ended'] })
  @IsIn(['rating', 'single_choice', 'multiple_choice', 'open_ended'])
  type!: 'rating' | 'single_choice' | 'multiple_choice' | 'open_ended';

  @ApiProperty()
  @IsString()
  text!: string;

  @ApiPropertyOptional({ type: [OptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OptionDto)
  options?: OptionDto[];

  @ApiProperty()
  @IsBoolean()
  required!: boolean;
}

export class CreateTrainingDto {
  @ApiProperty({ example: 'PRG-001' })
  @IsString()
  @IsNotEmpty()
  programCode!: string;

  @ApiProperty({ example: 'General' })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiProperty({ example: 'Sample Training' })
  @IsString()
  @IsNotEmpty()
  trainingTitle!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsString()
  @IsNotEmpty()
  startDate!: string;

  @ApiProperty({ example: '2026-01-03' })
  @IsString()
  @IsNotEmpty()
  endDate!: string;

  @ApiProperty({ example: 'Main Hall' })
  @IsString()
  @IsNotEmpty()
  venue!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hostedBy?: string;

  @ApiPropertyOptional({ type: [AgendaItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AgendaItemDto)
  agendaItems?: AgendaItemDto[];

  @ApiPropertyOptional({ type: [MaterialDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialDto)
  materials?: MaterialDto[];

  @ApiPropertyOptional({ type: [AssessmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssessmentDto)
  assessments?: AssessmentDto[];

  @ApiPropertyOptional({ type: [SurveyQuestionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurveyQuestionDto)
  surveyQuestions?: SurveyQuestionDto[];
}
