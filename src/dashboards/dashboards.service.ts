import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Dashboard } from './schemas/dashboard.schema';

@Injectable()
export class DashboardsService {
  constructor(@InjectModel(Dashboard.name) private model: Model<Dashboard>) {}

  getBasic(projectId: string) {
    // Stub simple KPIs
    return [
      { title: 'Total purchase', value: 120 },
      { title: 'Signups', value: 450 },
    ];
  }
}
