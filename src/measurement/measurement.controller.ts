import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAccessGuard } from '../common/guards/jwt-access.guard';
import { Response } from 'express';

import { MeasurementService } from './measurement.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('measurement')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('measurement')
export class MeasurementController {
  constructor(private service: MeasurementService) {}

  @Post('plan/generate')
  async generate(@CurrentUser() user: any, @Body() body: { projectId: string }) {
    const data = await this.service.generatePlan(body.projectId, user.sub || user._id);
    return { data };
  }

  @Get('datalayer')
  async datalayer(@CurrentUser() user: any, @Query('projectId') projectId: string, @Query('format') format = 'json') {
    const raw = await this.service.datalayer(projectId, user.sub || user._id, format as any);
    return { data: raw };
  }

  @Get('datalayer/download')
  async datalayerDownload(
    @CurrentUser() user: any,
    @Query('projectId') projectId: string,
    @Query('format') format: 'json' | 'js' = 'json',
    @Res() res: Response,
  ) {
    const raw = await this.service.datalayer(projectId, user.sub || user._id, format);
    res.setHeader('Content-Disposition', `attachment; filename=plan.${format}`);
    res.type(format === 'json' ? 'application/json' : 'application/javascript');
    res.send(raw);
  }
}
