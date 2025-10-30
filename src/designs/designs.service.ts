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
    // Este método ya no debería usarse, pero si se llama, devolver array vacío
    console.warn('[DESIGNS] importFigmaFile is deprecated, use figma.service directly');
    return {
      frames: [],
    };
  }

  async listFrames(projectId: string, userId: string) {
    try {
      // Buscar el archivo de Figma asociado a este proyecto
      const projectFigmaFile = await this.projectFigmaFileModel.findOne({ 
        projectId, 
        isActive: true 
      }).lean();
      
      if (!projectFigmaFile) {
        // En lugar de devolver mocks, devolver array vacío
        console.log('[DESIGNS] No Figma file associated with project:', projectId);
        return [];
      }

      // Obtener frames reales de Figma
      const candidateUserIds = Array.from(
        new Set(
          [userId, projectFigmaFile.userId].filter((id): id is string => Boolean(id)),
        ),
      );

      let lastError: unknown = null;
      for (const candidateId of candidateUserIds) {
        try {
          console.log('[DESIGNS] Trying to get frames with user:', candidateId);
          const result = await this.figmaService.getFileFrames(candidateId, projectFigmaFile.figmaFileKey);
          
          if (result?.frames && Array.isArray(result.frames)) {
            console.log('[DESIGNS] Successfully got frames:', result.frames.length);
            return result.frames;
          }
        } catch (error) {
          lastError = error;
          console.warn('[DESIGNS] Error getting frames with user', candidateId, error);
          
          // Si es un error 403, es específico y útil mostrarlo
          if (error && typeof error === 'object' && 'message' in error) {
            const errorMessage = (error as any).message;
            if (errorMessage.includes('Sin permisos') || errorMessage.includes('403')) {
              console.error('[DESIGNS] Permission denied for Figma file. User needs proper access.');
              // No intentar con otros usuarios si es un problema de permisos
              break;
            }
          }
        }
      }

      // Si llegamos aquí, no pudimos obtener frames reales
      console.error('[DESIGNS] Failed to get real frames, last error:', lastError);
      
      // En lugar de devolver mocks, devolver array vacío
      return [];
    } catch (error) {
      console.error('[DESIGNS] Error in listFrames:', error);
      // No devolver mocks, devolver array vacío
      return [];
    }
  }

  async getFrame(frameId: string) {
    return { id: frameId, name: 'Mock Frame', nodes: [] };
  }
}
