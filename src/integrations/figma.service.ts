import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';

interface FigmaDiscoveredFile {
  key: string;
  name: string;
  displayName: string;
  thumbnailUrl?: string;
  thumbnail_url?: string;
  lastModified?: string;
  last_modified?: string;
  url?: string;
  teamName?: string;
  teamId?: string;
  projectName?: string;
  projectId?: string;
  description?: string;
}

interface FigmaDiscoveredProject {
  id: string;
  name: string;
  files: FigmaDiscoveredFile[];
}

interface FigmaDiscoveredTeam {
  id: string;
  name: string;
  projects: FigmaDiscoveredProject[];
}

@Injectable()
export class FigmaService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async connectOAuth() {
    return { connected: true, provider: 'FIGMA' };
  }

  /**
   * Obtiene la lista de archivos del usuario desde Figma
   */
  async getUserFiles(userId: string) {
    if (process.env.NODE_ENV !== 'production') {
      // Log mínimo y no ruidoso en dev
      console.log('[FIGMA SERVICE] getUserFiles');
    }
    
    const user = await this.userModel.findById(userId).lean();
    
    const figmaToken = user?.providers?.figma?.oauth?.accessToken;
    // No logeamos el valor del token ni su ausencia en producción
    
    if (!figmaToken) {
      throw new Error('Usuario no tiene token de Figma');
    }

    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[FIGMA SERVICE] calling official Figma APIs');
      }
      
      // 1. Obtener información del usuario y sus equipos
      const userResponse = await fetch('https://api.figma.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${figmaToken}`,
          'User-Agent': 'Analytics-Weaver/1.0',
        },
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log('[FIGMA SERVICE] /v1/me status=', userResponse.status);
      }

      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        console.error('[FIGMA SERVICE] Figma user API error response:', errorText);
        throw new Error(`Figma API error: ${userResponse.status} - Token inválido o expirado`);
      }

      const userData = await userResponse.json();
      if (process.env.NODE_ENV !== 'production') {
        console.log('[FIGMA SERVICE] user ok, teams=', userData.teams?.length || 0);
      }

      // 2. Obtener archivos de todos los equipos del usuario
      let allFiles: any[] = [];

      if (userData.teams && Array.isArray(userData.teams) && userData.teams.length > 0) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[FIGMA SERVICE] teams=', userData.teams.length);
        }
        
        for (const team of userData.teams) {
          try {
            
            
            // 3. Obtener proyectos del equipo
            const projectsResponse = await fetch(`https://api.figma.com/v1/teams/${team.id}/projects`, {
              headers: {
                'Authorization': `Bearer ${figmaToken}`,
                'User-Agent': 'Analytics-Weaver/1.0',
              },
            });

            if (projectsResponse.ok) {
              const projectsData = await projectsResponse.json();
              
              
              if (projectsData.projects && Array.isArray(projectsData.projects)) {
                // 4. Para cada proyecto, obtener archivos
                for (const project of projectsData.projects) {
                  try {
                    
                    
                    const filesResponse = await fetch(`https://api.figma.com/v1/projects/${project.id}/files`, {
                      headers: {
                        'Authorization': `Bearer ${figmaToken}`,
                        'User-Agent': 'Analytics-Weaver/1.0',
                      },
                    });

                    if (filesResponse.ok) {
                      const filesData = await filesResponse.json();
                      
                      
                      if (filesData.files && Array.isArray(filesData.files)) {
                        // 5. Agregar metadata de equipo y proyecto a cada archivo
                        const filesWithMetadata = filesData.files.map((file: any) => ({
                          ...file,
                          teamName: team.name,
                          teamId: team.id,
                          projectName: project.name,
                          projectId: project.id,
                        }));
                        
                        allFiles = allFiles.concat(filesWithMetadata);
                      }
                    } else {
                      console.warn(`[FIGMA SERVICE] Failed to fetch files for project ${project.name}:`, filesResponse.status);
                    }
                  } catch (err) {
                    console.warn(`[FIGMA SERVICE] Error fetching files from project ${project.name}:`, err);
                  }
                }
              }
            } else {
              console.warn(`[FIGMA SERVICE] Failed to fetch projects for team ${team.name}:`, projectsResponse.status);
            }
          } catch (err) {
            console.warn(`[FIGMA SERVICE] Error processing team ${team.name}:`, err);
          }
        }
      } else {
        // Cuentas personales: NO intentamos endpoints experimentales/costosos.
        // Mostramos directamente ayuda y opción de agregado manual.
        if (process.env.NODE_ENV !== 'production') {
          console.log('[FIGMA SERVICE] no teams (personal account). Skipping alternative discovery.');
        }

        const personalAccountHelper = [{
          key: 'personal-account-info',
          name: '🏠 Cuenta Personal de Figma - Sin acceso automático a archivos',
          thumbnail_url: 'https://placehold.co/300x180/3b82f6/ffffff?text=🏠+Personal',
          last_modified: new Date().toISOString(),
          url: 'https://help.figma.com/hc/en-us/articles/360040328373-Create-a-team',
          teamName: 'Personal',
          teamId: 'personal',
          projectName: '⚠️ Limitación de API',
          projectId: 'config',
          description: 'La API de Figma no permite acceder automáticamente a archivos personales. Necesitas agregar tus archivos manualmente o crear un equipo.'
        }];

        allFiles = personalAccountHelper;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log('[FIGMA SERVICE] total files:', allFiles.length);
      }

      // Si no encontramos archivos, mostrar mensaje específico según el tipo de cuenta
      if (allFiles.length === 0) {
        
        return [{
          key: 'no-files-found',
          name: '⚠️ No se encontraron archivos accesibles',
          thumbnail_url: 'https://placehold.co/200x120/fbbf24/000000?text=Sin+Archivos',
          last_modified: new Date().toISOString(),
          url: 'https://www.figma.com',
          teamName: 'Sistema',
          teamId: 'system',
          projectName: 'Información',
          projectId: 'info',
        }];
      } else if (allFiles.length === 1 && allFiles[0].key === 'personal-account-info') {
        // Para cuentas personales, agregar opción de configuración manual mejorada
        
        allFiles.push({
          key: 'manual-add-file',
          name: '➕ Agregar tu archivo de Figma',
          thumbnail_url: 'https://placehold.co/300x180/10b981/ffffff?text=➕+Agregar',
          last_modified: new Date().toISOString(),
          url: 'manual-add',
          teamName: 'Personal',
          teamId: 'personal',
          projectName: '🔗 Configuración Manual',
          projectId: 'manual',
          description: 'Agrega la URL de tu archivo de Figma para empezar a crear eventos y funnels'
        }, {
          key: 'figma-help',
          name: '📚 ¿Cómo obtener la URL de mi archivo?',
          thumbnail_url: 'https://placehold.co/300x180/8b5cf6/ffffff?text=❓+Ayuda',
          last_modified: new Date().toISOString(),
          url: 'https://help.figma.com/hc/en-us/articles/360038006754-Share-files-and-prototypes',
          teamName: 'Personal',
          teamId: 'personal',
          projectName: '📖 Guía de Ayuda',
          projectId: 'help',
          description: 'Aprende cómo compartir y obtener URLs de tus archivos de Figma'
        });
      }

      // 6. Transformar la respuesta al formato esperado
      const transformedFiles = allFiles.map((file: any) => {
        const safeName = file.name || 'Archivo sin nombre';
        const figmaUrl = file.key && file.key !== 'manual-add'
          ? `https://www.figma.com/file/${file.key}/${encodeURIComponent(safeName)}`
          : file.url;

        const thumbnail = file.thumbnail_url;
        const lastModified = file.last_modified;

        return {
          key: file.key,
          name: safeName,
          displayName: `${safeName}${file.projectName ? ` (${file.projectName})` : ''}`,
          thumbnailUrl: thumbnail,
          thumbnail_url: thumbnail,
          lastModified,
          last_modified: lastModified,
          url: figmaUrl,
          // Metadata adicional
          teamName: file.teamName,
          teamId: file.teamId,
          projectName: file.projectName,
          projectId: file.projectId,
          description: file.description,
        };
      });

      const teamsMap = new Map<string, {
        id: string;
        name: string;
        projects: Map<string, FigmaDiscoveredProject>;
      }>();

      transformedFiles.forEach((file) => {
        const teamId = file.teamId || 'unknown-team';
        const projectId = file.projectId || 'unknown-project';

        if (!teamsMap.has(teamId)) {
          teamsMap.set(teamId, {
            id: teamId,
            name: file.teamName || 'Equipo sin nombre',
            projects: new Map(),
          });
        }

        const team = teamsMap.get(teamId)!;
        if (!team.projects.has(projectId)) {
          team.projects.set(projectId, {
            id: projectId,
            name: file.projectName || 'Proyecto sin nombre',
            files: [],
          });
        }

        const project = team.projects.get(projectId)!;
        project.files.push(file);
      });

      const teams: FigmaDiscoveredTeam[] = Array.from(teamsMap.values()).map((team) => ({
        id: team.id,
        name: team.name,
        projects: Array.from(team.projects.values()).map((project) => ({
          id: project.id,
          name: project.name,
          files: project.files,
        })),
      }));

      if (process.env.NODE_ENV !== 'production') {
        console.log('[FIGMA SERVICE] returning files:', transformedFiles.length);
      }

      return {
        summary: {
          totalTeams: teams.length,
          totalProjects: teams.reduce((acc, team) => acc + team.projects.length, 0),
          totalFiles: transformedFiles.length,
          generatedAt: new Date().toISOString(),
          figmaUserEmail: userData.email || null,
          figmaUserHandle: userData.handle || null,
          figmaUserId: userData.id || null,
        },
        teams,
        files: transformedFiles,
      };
      
    } catch (error) {
      console.error('[FIGMA SERVICE] Error fetching user files:', error);
      throw new Error('Error al obtener archivos de Figma');
    }
  }

  // Se elimina el descubrimiento alternativo/experimental para evitar costos y ruido de logs.

  /**
   * Obtiene los frames de un archivo específico de Figma
   */
  async getFileFrames(userId: string, fileKey: string) {
    console.log('[FIGMA SERVICE] Getting frames for file:', fileKey, 'user:', userId);
    
    const user = await this.userModel.findById(userId).lean();
    const figmaToken = user?.providers?.figma?.oauth?.accessToken;
    const expiresAt = user?.providers?.figma?.oauth?.expiresAt;
    
    if (!figmaToken) {
      console.error('[FIGMA SERVICE] No Figma token for user:', userId);
      throw new Error('Usuario no tiene token de Figma');
    }

    // Verificar si el token ha expirado
    if (expiresAt) {
      const expirationDate = new Date(expiresAt);
      const now = new Date();
      if (now >= expirationDate) {
        console.error('[FIGMA SERVICE] Figma token expired at:', expiresAt);
        throw new Error('Token de Figma expirado. Por favor, reconecta tu cuenta de Figma.');
      }
    }

    try {
      // Primero, verificar que el token sea válido consultando /v1/me
      console.log('[FIGMA SERVICE] Verifying token validity');
      const meResponse = await fetch('https://api.figma.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${figmaToken}`,
          'User-Agent': 'Analytics-Weaver/1.0',
        },
      });

      if (!meResponse.ok) {
        console.error('[FIGMA SERVICE] Token validation failed:', meResponse.status, meResponse.statusText);
        if (meResponse.status === 401) {
          throw new Error('Token de Figma inválido o expirado. Reconecta tu cuenta de Figma.');
        }
        throw new Error(`Error validando token de Figma: ${meResponse.status}`);
      }

      const meData = await meResponse.json();
      console.log('[FIGMA SERVICE] Token valid, user:', meData.email || meData.handle);

      // Obtener información del archivo
      console.log('[FIGMA SERVICE] Fetching file data from Figma API');
      const fileResponse = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
        headers: {
          'Authorization': `Bearer ${figmaToken}`,
          'User-Agent': 'Analytics-Weaver/1.0',
        },
      });

      if (!fileResponse.ok) {
        const errorText = await fileResponse.text();
        console.error('[FIGMA SERVICE] Figma API error:', fileResponse.status, fileResponse.statusText);
        console.error('[FIGMA SERVICE] Error details:', errorText);
        
        if (fileResponse.status === 403) {
          throw new Error('Sin permisos para acceder a este archivo de Figma. El archivo debe ser público o debes tener acceso explícito. Intenta: 1) Hacer el archivo público en Figma, o 2) Asegurarte de tener permisos de visualización en el archivo.');
        } else if (fileResponse.status === 404) {
          throw new Error('Archivo de Figma no encontrado. Verifica que la URL del archivo sea correcta.');
        } else if (fileResponse.status === 401) {
          throw new Error('Token de Figma inválido o expirado. Reconecta tu cuenta de Figma.');
        } else {
          throw new Error(`Error de Figma API: ${fileResponse.status} - ${errorText.slice(0, 100)}`);
        }
      }

      const fileData = await fileResponse.json();
      console.log('[FIGMA SERVICE] File data received, extracting frames...');
      
      // Extraer todos los frames del archivo
      const frames = this.extractFrames(fileData.document);
      console.log('[FIGMA SERVICE] Extracted frames count:', frames.length);
      
      if (frames.length === 0) {
        console.warn('[FIGMA SERVICE] No frames found in file');
        return { frames: [] };
      }

      // Obtener las imágenes de los frames
      const frameIds = frames.map(f => f.id).join(',');
      console.log('[FIGMA SERVICE] Fetching frame images for IDs:', frameIds);
      
      const imagesResponse = await fetch(
        `https://api.figma.com/v1/images/${fileKey}?ids=${frameIds}&format=png&scale=1`,
        {
          headers: {
            'Authorization': `Bearer ${figmaToken}`,
            'User-Agent': 'Analytics-Weaver/1.0',
          },
        }
      );

      let imagesData = { images: {} };
      if (imagesResponse.ok) {
        imagesData = await imagesResponse.json();
        console.log('[FIGMA SERVICE] Images data received:', Object.keys(imagesData.images || {}).length, 'images');
      } else {
        console.warn('[FIGMA SERVICE] Could not fetch frame images:', imagesResponse.status);
      }
      
      // Combinar frames con sus imágenes
      const result = {
        frames: frames.map(frame => ({
          id: frame.id,
          name: frame.name,
          x: frame.absoluteBoundingBox?.x || 0,
          y: frame.absoluteBoundingBox?.y || 0,
          width: frame.absoluteBoundingBox?.width || 375,
          height: frame.absoluteBoundingBox?.height || 812,
          thumbUrl: (imagesData.images as any)?.[frame.id] || null,
          components: this.extractComponents(frame),
        }))
      };
      
      console.log('[FIGMA SERVICE] Returning frames:', result.frames.length);
      return result;
    } catch (error) {
      console.error('[FIGMA SERVICE] Error fetching file frames:', error);
      throw new Error('Error al obtener pantallas de Figma');
    }
  }

  /**
   * Extrae todos los frames de un documento de Figma
   */
  private extractFrames(node: any, frames: any[] = []): any[] {
    // Solo agregar nodos de tipo 'CANVAS' que contienen los frames principales
    if (node.type === 'CANVAS' && node.children) {
      for (const child of node.children) {
        // Dentro de un canvas, solo nos interesan los 'FRAME' de nivel superior
        if (child.type === 'FRAME') {
          frames.push(child);
        }
      }
    } else if (node.children) {
      // Si no estamos en un canvas, seguimos buscando recursivamente
      for (const child of node.children) {
        this.extractFrames(child, frames);
      }
    }
    
    return frames;
  }

  /**
   * Extrae componentes interactivos de un frame
   */
  private extractComponents(frame: any): any[] {
    const components: any[] = [];
    
    const extractFromNode = (node: any) => {
      // Buscar nodos que podrían ser componentes interactivos
      if (node.type === 'TEXT' || 
          node.type === 'RECTANGLE' || 
          node.type === 'INSTANCE' ||
          (node.name && (
            node.name.toLowerCase().includes('button') ||
            node.name.toLowerCase().includes('input') ||
            node.name.toLowerCase().includes('click') ||
            node.name.toLowerCase().includes('link')
          ))) {
        
        components.push({
          id: node.id,
          name: node.name || 'Unnamed Component',
          type: node.type,
          x: node.absoluteBoundingBox?.x || 0,
          y: node.absoluteBoundingBox?.y || 0,
          width: node.absoluteBoundingBox?.width || 0,
          height: node.absoluteBoundingBox?.height || 0,
        });
      }
      
      if (node.children) {
        for (const child of node.children) {
          extractFromNode(child);
        }
      }
    };
    
    extractFromNode(frame);
    return components;
  }

  /**
   * Mantener compatibilidad con el método anterior
   */
  async listFrames(fileKey: string) {
    // Este es el método que se usaba antes, ahora redirigir al nuevo
    // Por ahora devolver datos mock hasta que se implemente la integración completa
    return [
      { id: 'frame_1', name: 'Home / Hero', thumbUrl: 'https://placehold.co/200x120' },
      { id: 'frame_2', name: 'Checkout / Step 1', thumbUrl: 'https://placehold.co/200x120' },
    ];
  }
}
