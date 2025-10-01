import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class MeasurementPlan {
  @Prop({ type: String, required: true })
  projectId!: string;

  @Prop({ type: [String], default: [] })
  events!: string[]; // ObjectId<Event> as string ids

  @Prop({ type: Object, default: { naming: 'snake' } })
  conventions!: { naming: 'snake' | 'camel' };

  @Prop({ type: Number, default: 1 })
  version!: number;

  @Prop({ type: String })
  createdBy?: string;
}

export const MeasurementPlanSchema = SchemaFactory.createForClass(MeasurementPlan);
MeasurementPlanSchema.index({ projectId: 1, version: -1 });
