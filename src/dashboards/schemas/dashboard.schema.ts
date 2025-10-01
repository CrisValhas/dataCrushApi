import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class Dashboard {
  @Prop({ type: String, required: true })
  projectId!: string;

  @Prop({ type: Array, default: [] })
  cards!: { type: 'kpi' | 'chart'; query: { eventId?: string; metric: string }; title: string }[];
}

export const DashboardSchema = SchemaFactory.createForClass(Dashboard);
