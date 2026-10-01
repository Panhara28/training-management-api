import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsUUID, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  staffRoleId?: string | null;

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
