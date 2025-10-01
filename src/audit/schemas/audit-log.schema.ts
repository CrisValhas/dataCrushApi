import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ type: String, required: true })
  actorId!: string;

  @Prop({ type: String })
  projectId?: string;

  @Prop({ type: String, required: true })
  action!: string;

  @Prop({ type: String, required: true })
  target!: string;

  @Prop({ type: Object, default: {} })
  meta?: any;

  @Prop({ type: Date, default: Date.now })
  at!: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
