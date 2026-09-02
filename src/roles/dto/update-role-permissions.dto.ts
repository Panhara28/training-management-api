import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, ValidateNested } from 'class-validator';

export class PermissionFlagDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  moduleId!: number;

  @ApiProperty()
  @IsBoolean()
  create!: boolean;

  @ApiProperty()
  @IsBoolean()
  read!: boolean;

  @ApiProperty()
  @IsBoolean()
  update!: boolean;

  @ApiProperty()
  @IsBoolean()
  delete!: boolean;
}

export class UpdateRolePermissionsDto {
  @ApiProperty({ type: [PermissionFlagDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionFlagDto)
  permissions!: PermissionFlagDto[];
}
