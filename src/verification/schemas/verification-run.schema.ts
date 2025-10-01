import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class VerificationRun {
  @Prop({ type: String, required: true })
  projectId!: string;

  @Prop({ type: Date, default: Date.now })
  startedAt!: Date;

  @Prop({ type: String, enum: ['running', 'done', 'error'], default: 'running' })
  status!: 'running' | 'done' | 'error';

  @Prop({ type: Array, default: [] })
  results!: { eventId: string; state: 'implemented' | 'pending' | 'error'; lastSeenAt?: Date; notes?: string }[];
}

export const VerificationRunSchema = SchemaFactory.createForClass(VerificationRun);
