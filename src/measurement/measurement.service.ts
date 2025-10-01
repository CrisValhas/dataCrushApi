import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { EventsService } from '../events/events.service';
import { MeasurementPlan } from './schemas/measurement-plan.schema';
import { DataLayerGeneratorService } from './datalayer/generator.service';

@Injectable()
export class MeasurementService {
  constructor(
    @InjectModel(MeasurementPlan.name) private model: Model<MeasurementPlan>,
    private events: EventsService,
    private generator: DataLayerGeneratorService,
  ) {}

  async generatePlan(projectId: string, userId: string) {
    const evs: any[] = await this.events.findAll(projectId, userId);
    const plan = await this.model.create({
      projectId,
      events: evs.map((e) => String(e._id)),
      conventions: { naming: 'snake' },
      version: 1,
    });
    return plan;
  }

  async datalayer(projectId: string, userId: string, format: 'json' | 'js' = 'json') {
    const evs: any[] = await this.events.findAll(projectId, userId);
    if (format === 'js') return this.generator.generateJs(projectId, evs, 1);
    return this.generator.generateJson(projectId, evs, 1);
  }
}
