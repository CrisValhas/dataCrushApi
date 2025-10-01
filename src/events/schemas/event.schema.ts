import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class Event {
  @Prop({ type: String, required: true })
  projectId!: string;

  @Prop({ type: String })
  frameId?: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  category!: string;

  @Prop({ type: String, required: true })
  actionType!: string; // click | submit | view | ...

  @Prop({ type: String, required: true })
  component!: string; // header | hero | ...

  @Prop({ type: String })
  selector?: string;

  @Prop({ type: Object, default: {} })
  metadata?: any;

  @Prop({ type: String, enum: ['draft', 'approved'], default: 'draft' })
  status!: 'draft' | 'approved';

  @Prop({ type: String, required: true })
  createdBy!: string; // userId owner
}

export const EventSchema = SchemaFactory.createForClass(Event);
EventSchema.index({ projectId: 1, name: 1 });
EventSchema.index({ createdBy: 1, projectId: 1 });
