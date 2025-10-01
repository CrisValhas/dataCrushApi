import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAccessGuard } from '../common/guards/jwt-access.guard';

import { FunnelsService } from './funnels.service';

@ApiTags('funnels')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('funnels')
export class FunnelsController {
  constructor(private service: FunnelsService) {}

  @Get(':projectId')
  async list(@Param('projectId') projectId: string) {
    const data = await this.service.list(projectId);
    return { data };
  }

  @Post()
  async create(@Body() dto: any) { const data = await this.service.create(dto); return { data }; }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: any) { const data = await this.service.update(id, dto); return { data }; }

  @Delete(':id')
  async remove(@Param('id') id: string) { const data = await this.service.remove(id); return { data }; }

  @Post(':id/preview')
  async preview(@Param('id') id: string) {
    // Stub preview
    return { data: { id, steps: 3, conversionRate: 0.42 } };
  }
}
