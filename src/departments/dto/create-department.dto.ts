import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'General Department' })
  @IsString()
  @IsNotEmpty()
  name!: string;
}
