import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class Project {
  @Prop({ type: String, required: true })
  teamId!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String, default: 'ARS' })
  defaultCurrency?: 'ARS' | string;

  @Prop({ type: Object, default: {} })
  connected?: any;

  @Prop({ type: String, required: true })
  createdBy!: string; // userId owner

  // GA4: Property ID por proyecto (por ejemplo, "properties/123456789")
  @Prop({ type: String })
  ga4PropertyId?: string;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
ProjectSchema.index({ teamId: 1, name: 1 });
ProjectSchema.index({ createdBy: 1, name: 1 });
