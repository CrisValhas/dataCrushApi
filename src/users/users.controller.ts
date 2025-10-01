import { Body, Controller, Get, Patch, UseGuards, Res, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { JwtAccessGuard } from '../common/guards/jwt-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('me')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('me')
export class UsersController {
  constructor(@InjectModel('User') private userModel: Model<any>) {}

  @Get()
  async getMe(@CurrentUser() user: any, @Res({ passthrough: true }) res: Response) {
    // Evitar 304 inmediatamente después de integrar un provider
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const full = await this.userModel
      .findById(user.sub || user._id)
      .select({ email: 1, displayName: 1, avatarUrl: 1, providers: 1 })
      .lean();
    return { data: { ...(full || {}), sub: user.sub } };
  }

  @Patch()
  async updateMe(
    @CurrentUser() user: any,
    @Body() body: { displayName?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { displayName } = body || {};
    if (typeof displayName !== 'string') {
      throw new BadRequestException('displayName requerido');
    }
    const trimmed = displayName.trim();
    if (!trimmed || trimmed.length > 120) {
      throw new BadRequestException('displayName inválido');
    }

    await this.userModel
      .updateOne({ _id: user.sub || user._id }, { $set: { displayName: trimmed } })
      .exec();
    const full = await this.userModel
      .findById(user.sub || user._id)
      .select({ email: 1, displayName: 1, avatarUrl: 1, providers: 1 })
      .lean();
    return { data: { ...(full || {}), sub: user.sub } };
  }
}
