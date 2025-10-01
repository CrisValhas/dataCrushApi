import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { MeasurementController } from './measurement.controller';
import { MeasurementService } from './measurement.service';
import { MeasurementPlan, MeasurementPlanSchema } from './schemas/measurement-plan.schema';
import { DataLayerGeneratorService } from './datalayer/generator.service';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    EventsModule,
    MongooseModule.forFeature([{ name: MeasurementPlan.name, schema: MeasurementPlanSchema }]),
  ],
  controllers: [MeasurementController],
  providers: [MeasurementService, DataLayerGeneratorService],
})
export class MeasurementModule {}
