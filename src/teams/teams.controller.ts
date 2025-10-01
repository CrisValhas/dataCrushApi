import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { TeamsService } from './teams.service';

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  constructor(private service: TeamsService) {}

  @Get()
  async list() { const data = await this.service.list(); return { data }; }
  @Post()
  async create(@Body() dto: any) { const data = await this.service.create(dto); return { data }; }
  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: any) { const data = await this.service.update(id, dto); return { data }; }
  @Delete(':id')
  async remove(@Param('id') id: string) { const data = await this.service.remove(id); return { data }; }
}
