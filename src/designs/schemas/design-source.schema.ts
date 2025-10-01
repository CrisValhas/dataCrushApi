import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class DesignSource {
  @Prop({ type: String, required: true })
  projectId!: string;

  @Prop({ type: String, enum: ['figma_oauth', 'figma_file', 'upload'], required: true })
  type!: 'figma_oauth' | 'figma_file' | 'upload';

  @Prop({ type: String })
  figmaFileId?: string;

  @Prop({ type: [String], default: [] })
  figmaNodeIds?: string[];

  @Prop({ type: [String], default: [] })
  thumbnailUrls?: string[];

  @Prop({ type: Array, default: [] })
  frames?: { id: string; name: string; thumbUrl?: string }[];

  @Prop({ type: Date, default: Date.now })
  importedAt!: Date;
}

export const DesignSourceSchema = SchemaFactory.createForClass(DesignSource);
