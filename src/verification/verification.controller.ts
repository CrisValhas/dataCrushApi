import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAccessGuard } from '../common/guards/jwt-access.guard';

import { VerificationService } from './verification.service';

@ApiTags('verification')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('verification')
export class VerificationController {
  constructor(private service: VerificationService) {}

  @Post('run')
  async run(@Body() body: { projectId: string }) {
    const data = await this.service.run(body.projectId);
    return { data };
  }

  @Get(':runId')
  async get(@Param('runId') runId: string) {
    const data = await this.service.get(runId);
    return { data };
  }
}
