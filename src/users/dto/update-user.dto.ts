import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  staffRoleId?: number | null;

  @ApiPropertyOptional({ enum: ['ADMIN', 'TRAINER'] })
  @IsOptional()
  @IsIn(['ADMIN', 'TRAINER'])
  role?: 'ADMIN' | 'TRAINER';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullNameKh?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  generalDepartment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  departmentOffice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currentRole?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
