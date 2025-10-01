import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class ProjectFigmaFile extends Document {
  @Prop({ required: true })
  projectId!: string;

  @Prop({ required: true })
  userId!: string;

  @Prop({ required: true })
  figmaFileKey!: string;

  @Prop({ required: true })
  figmaFileName!: string;

  @Prop()
  figmaFileUrl?: string;

  @Prop()
  figmaThumbnail?: string;

  @Prop({ default: Date.now })
  lastSynced?: Date;

  @Prop({ default: true })
  isActive!: boolean;
}

export const ProjectFigmaFileSchema = SchemaFactory.createForClass(ProjectFigmaFile);

// Índice único para evitar múltiples archivos por proyecto
ProjectFigmaFileSchema.index({ projectId: 1 }, { unique: true });