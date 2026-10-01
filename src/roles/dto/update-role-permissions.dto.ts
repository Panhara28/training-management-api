import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsUUID, ValidateNested } from 'class-validator';

export class PermissionFlagDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  moduleId!: string;

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
