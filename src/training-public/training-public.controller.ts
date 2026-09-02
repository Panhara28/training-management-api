import { Body, Controller, HttpCode, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse } from '@nestjs/swagger';
import { TrainingPublicService } from './training-public.service';
import { RegisterDto } from './dto/register.dto';

@ApiTags('Public Training Registration')
@Controller('api/public/trainings')
export class TrainingPublicController {
  constructor(private readonly trainingPublicService: TrainingPublicService) {}

  @Post(':id/register')
  @HttpCode(201)
  @ApiOperation({ summary: 'Self-register a participant into a published training' })
  @ApiCreatedResponse({ description: '{ ok: true }' })
  register(@Param('id', ParseIntPipe) id: number, @Body() body: RegisterDto) {
    return this.trainingPublicService.register(id, body);
  }
}
