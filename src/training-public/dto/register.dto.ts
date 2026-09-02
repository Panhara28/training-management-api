import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

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
}
