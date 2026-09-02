import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { SessionStatus, PublishStatus } from '@prisma/client';

export class UpdateSessionDto {
  @ApiPropertyOptional({ enum: SessionStatus })
  @IsOptional()
  @IsIn(Object.values(SessionStatus))
  status?: SessionStatus;

  @ApiPropertyOptional({ enum: PublishStatus })
  @IsOptional()
  @IsIn(Object.values(PublishStatus))
  publishStatus?: PublishStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  surveyEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  materialsEnabled?: boolean;
}
