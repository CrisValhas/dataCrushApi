import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProjectFigmaFile } from '../projects/schemas/project-figma-file.schema';
import { FigmaService } from '../integrations/figma.service';

@Injectable()
export class DesignsService {
  constructor(
    @InjectModel(ProjectFigmaFile.name) private projectFigmaFileModel: Model<ProjectFigmaFile>,
    private figmaService: FigmaService,
  ) {}

  async importFigmaFile(_fileKey: string, _nodeIds?: string[]) {
    return {
      frames: [
        { id: 'frame_1', name: 'Home / Hero', thumbUrl: 'https://placehold.co/200x120' },
        { id: 'frame_2', name: 'Checkout / Step 1', thumbUrl: 'https://placehold.co/200x120' },
      ],
    };
  }

  async listFrames(projectId: string, userId: string) {
    try {
      // Buscar el archivo de Figma asociado a este proyecto (independiente del userId)
      const projectFigmaFile = await this.projectFigmaFileModel.findOne({ projectId });
      
      if (!projectFigmaFile) {
        // Si no hay archivo asociado, devolver mock data
        return [
          { id: `${projectId}_frame_1`, name: 'Mock Frame 1', thumbUrl: 'https://placehold.co/200x120' },
        ];
      }

      // Obtener frames reales de Figma
  const result = await this.figmaService.getFileFrames(userId, projectFigmaFile.figmaFileKey);
      return result.frames || [];
    } catch (error) {
      console.error('Error listing frames:', error);
      // Fallback a mock data si hay error
      return [
        { id: `${projectId}_frame_1`, name: 'Mock Frame 1', thumbUrl: 'https://placehold.co/200x120' },
      ];
    }
  }

  async getFrame(frameId: string) {
    return { id: frameId, name: 'Mock Frame', nodes: [] };
  }
}
