import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAccessGuard } from '../common/guards/jwt-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

import { DesignsService } from './designs.service';

@ApiTags('designs')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('designs')
export class DesignsController {
  constructor(private service: DesignsService) {}

  @Post('import/figma-file')
  async importFigma(@Body() body: { fileKey: string; nodeIds?: string[] }) {
    const data = await this.service.importFigmaFile(body.fileKey, body.nodeIds);
    return { data };
  }

  @Get(':projectId/frames')
  async frames(@CurrentUser() user: any, @Param('projectId') projectId: string) {
    const data = await this.service.listFrames(projectId, user.sub || user._id);
    return { data };
  }

  @Get('frame/:frameId')
  async frame(@Param('frameId') frameId: string) {
    const data = await this.service.getFrame(frameId);
    return { data };
  }
}
