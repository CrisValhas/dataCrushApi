import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class Team {
  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true })
  ownerId!: string;

  @Prop({ type: Array, default: [] })
  members!: { userId: string; role: 'owner' | 'admin' | 'editor' | 'viewer' }[];
}

export const TeamSchema = SchemaFactory.createForClass(Team);
