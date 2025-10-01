import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAccessGuard } from '../common/guards/jwt-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private service: ProjectsService) {}

  @Get()
  async list(@CurrentUser() user: any, @Query('teamId') teamId?: string) {
    const data = await this.service.findAllByUser(user.sub || user._id, teamId);
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
}
