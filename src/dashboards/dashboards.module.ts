import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';
import { Dashboard, DashboardSchema } from './schemas/dashboard.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Dashboard.name, schema: DashboardSchema }])],
  controllers: [DashboardsController],
  providers: [DashboardsService],
})
export class DashboardsModule {}
