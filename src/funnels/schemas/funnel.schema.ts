import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class Funnel {
  @Prop({ type: String, required: true })
  projectId!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: Array, default: [] })
  steps!: { eventId: string; alias?: string }[];
}

export const FunnelSchema = SchemaFactory.createForClass(Funnel);
