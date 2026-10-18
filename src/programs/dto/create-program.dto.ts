import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateProgramDto {
  @ApiProperty({ example: 'Sample Training Program' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiPropertyOptional({ example: 'កម្មវិធីគំរូ' })
  @IsOptional()
  @IsString()
  titleKh?: string;

  @ApiPropertyOptional({ example: 'Program description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'General' })
  @IsString()
  @IsNotEmpty()
  category!: string;

  @ApiProperty({ example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationDays!: number;
}
