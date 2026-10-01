import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsUUID, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullNameKh?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phoneNumber?: string;

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

  @ApiProperty({ enum: ['ADMIN', 'TRAINER'] })
  @IsIn(['ADMIN', 'TRAINER'])
  role!: 'ADMIN' | 'TRAINER';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  staffRoleId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
