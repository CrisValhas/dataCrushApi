import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class Invite {
  @Prop({ type: String, required: true })
  teamId!: string;

  @Prop({ type: String, required: true })
  email!: string;

  @Prop({ type: String, enum: ['admin', 'editor', 'viewer'], required: true })
  role!: 'admin' | 'editor' | 'viewer';
}

export const InviteSchema = SchemaFactory.createForClass(Invite);
