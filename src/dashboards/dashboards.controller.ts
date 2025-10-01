import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAccessGuard } from '../common/guards/jwt-access.guard';
import { Response } from 'express';

import { DashboardsService } from './dashboards.service';

@ApiTags('dashboards')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('dashboards')
export class DashboardsController {
  constructor(private service: DashboardsService) {}

  @Get(':projectId/basic')
  basic(@Param('projectId') projectId: string) {
    const data = this.service.getBasic(projectId);
    return { data };
  }

  @Get(':projectId/export/csv')
  csv(@Param('projectId') projectId: string, @Res() res: Response) {
    const rows = this.service.getBasic(projectId);
    const csv = 'title,value\n' + rows.map((r) => `${r.title},${r.value}`).join('\n');
    res.setHeader('Content-Disposition', 'attachment; filename=basic.csv');
    res.type('text/csv');
    res.send(csv);
  }
}
