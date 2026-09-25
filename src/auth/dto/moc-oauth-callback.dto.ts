import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class MocOauthCallbackDto {
  @ApiProperty({ description: 'Authorization code returned by AAS' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'State returned by AAS' })
  @IsString()
  @IsNotEmpty()
  state!: string;
}
