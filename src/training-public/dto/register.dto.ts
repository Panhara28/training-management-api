import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fullNameKh!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  generalDepartment!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  departmentOffice!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  currentRole!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'OTHER'] })
  @IsOptional()
  @IsIn(['MALE', 'FEMALE', 'OTHER'])
  gender?: 'MALE' | 'FEMALE' | 'OTHER';

  // Optional: lets a self-registering participant set a password so they can
  // sign in to the portal afterwards without AAS or a phone (see Issue #1 —
  // previously self-registered accounts got an unusable random password).
  @ApiPropertyOptional({ description: 'Lets the participant log in to the portal later without AAS.' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
