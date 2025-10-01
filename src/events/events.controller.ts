import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAccessGuard } from '../common/guards/jwt-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

import { EventsService } from './events.service';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('events')
export class EventsController {
  constructor(private service: EventsService) {}

  @Get()
  async list(@CurrentUser() user: any, @Query('projectId') projectId: string) {
    const data = await this.service.findAll(projectId, user.sub || user._id);
    return { data };
  }

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: any) {
    const data = await this.service.create({ ...dto, createdBy: user.sub || user._id });
    return { data };
  }

  @Put(':id')
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: any) {
    const data = await this.service.update(id, user.sub || user._id, dto);
    return { data };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    const data = await this.service.remove(id, user.sub || user._id);
    return { data };
  }

  @Get('counts')
  async counts(@CurrentUser() user: any, @Query('projectIds') projectIds?: string) {
    const ids = projectIds ? projectIds.split(',').filter(Boolean) : undefined;
    const data = await this.service.countsByProject(user.sub || user._id, ids);
    return { data };
  }
}
