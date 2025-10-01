import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class PlatformConnection {
  @Prop({ type: String, required: true })
  projectId!: string;

  @Prop({ type: String, enum: ['GTM', 'GA4', 'FIGMA'], required: true })
  platform!: 'GTM' | 'GA4' | 'FIGMA';

  @Prop({ type: Object })
  oauth?: { accessToken: string; refreshToken?: string; expiresAt?: string };

  @Prop({ type: Object, default: {} })
  properties?: any;

  // When true, indicates the user-level integration is disabled for this project
  @Prop({ type: Boolean, default: false })
  disabled?: boolean;
}

export const PlatformConnectionSchema = SchemaFactory.createForClass(PlatformConnection);
PlatformConnectionSchema.index({ projectId: 1, platform: 1 }, { unique: true });
