import { Body, Controller, Get, Post, Delete, Query, Res, UseGuards, Param, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAccessGuard } from '../common/guards/jwt-access.guard';
import { Response } from 'express';

import { FigmaService } from './figma.service';
import { GtmService } from './gtm.service';
import { Ga4Service } from './ga4.service';
import { LookerService } from './looker.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PlatformConnection } from './schemas/platform-connection.schema';
import { Project } from '../projects/schemas/project.schema';
import { Event } from '../events/schemas/event.schema';
import { User } from '../users/schemas/user.schema';
import { ProjectFigmaFile } from '../projects/schemas/project-figma-file.schema';
import { ulid } from 'ulid';

@ApiTags('integrations')
@ApiBearerAuth()
@UseGuards(JwtAccessGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(
    private figma: FigmaService,
    private gtm: GtmService,
    private ga4: Ga4Service,
    private looker: LookerService,
    @InjectModel(PlatformConnection.name) private pcModel: Model<PlatformConnection>,
    @InjectModel(Project.name) private projectModel: Model<Project>,
    @InjectModel(Event.name) private eventModel: Model<Event>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(ProjectFigmaFile.name) private projectFigmaFileModel: Model<ProjectFigmaFile>,
  ) {}

  @Post('gtm/connect')
  connectGtm() {
    return { data: this.gtm.connectOAuth() };
  }

  @Post('ga4/connect')
  connectGa4() {
    return { data: this.ga4.connectOAuth() };
  }

  @Get('gtm/containers')
  async containers() {
    const data = await this.gtm.listContainers();
    return { data };
  }

  @Post('gtm/export')
  async export(@Body() body: { projectId: string }) {
    const data = await this.gtm.exportWorkspace(body.projectId);
    return { data };
  }

  @Post('figma/connect')
  connectFigma() {
    return { data: this.figma.connectOAuth() };
  }

  @Get('looker/template-link')
  template(@Query('projectId') projectId: string) {
    return { data: { url: this.looker.templateLink(projectId) } };
  }

  @Get('dashboards/:projectId/export/csv')
  exportCsv(@Query('projectId') projectId: string, @Res() res: Response) {
    const csv = this.looker.exportCsv(projectId);
    res.setHeader('Content-Disposition', 'attachment; filename=dashboard.csv');
    res.type('text/csv');
    res.send(csv);
  }

  @Get('connections')
  async connections(@CurrentUser() user: any, @Query('projectIds') projectIds?: string, @Res({ passthrough: true }) res?: Response) {
    // Evitar respuestas cacheadas por el navegador (304) mientras el usuario espera ver integraciones recién conectadas
    if (res) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    const startedAt = Date.now();
    const safeLog = (msg: string, extra?: any) => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log(`[INTEGRATIONS:connections] ${msg}`, extra || '');
      }
    };
    if (!user) {
      safeLog('No user in request.user (posible fallo guard JWT)');
      return { data: {} };
    }
    try {
      const userId = user.sub || user._id;
      const rawIds = (projectIds ? projectIds.split(',') : []).filter(Boolean);
      // Validar formato ObjectId (24 hex) para evitar CastError que detonaría 500
      const oidRegex = /^[a-fA-F0-9]{24}$/;
      const filtered = rawIds.filter((id) => oidRegex.test(id));
      let ids: string[];
      if (projectIds) {
        const owned = await this.projectModel
          .find({ _id: { $in: filtered }, createdBy: userId })
          .select({ _id: 1 })
          .lean();
        ids = owned.map((d: any) => String(d._id));
      } else {
        const owned = await this.projectModel.find({ createdBy: userId }).select({ _id: 1 }).lean();
        ids = owned.map((d: any) => String(d._id));
      }
      if (ids.length === 0) {
        safeLog('Sin proyectos pertenecientes al usuario', { userId });
        return { data: {} };
      }
      const pcs = await this.pcModel
        .find({ projectId: { $in: ids } })
        .select({ projectId: 1, platform: 1, disabled: 1 })
        .lean();
      const map: Record<string, string[]> = {};
      const disabledPerProject: Record<string, Set<string>> = {};
      for (const id of ids) map[id] = [];
      for (const pc of pcs) {
        const pid = String((pc as any).projectId);
        if (!map[pid]) map[pid] = [];
        if (!(pc as any).disabled) {
          map[pid].push((pc as any).platform);
        } else {
          if (!disabledPerProject[pid]) disabledPerProject[pid] = new Set<string>();
          disabledPerProject[pid].add((pc as any).platform);
        }
      }
      // Nota: A partir de ahora NO inferimos conexiones por proyecto desde tokens a nivel usuario.
      // Solo reflejamos conexiones explícitas almacenadas en PlatformConnection (disabled !== true).
      // Esto evita que una conexión se "propague" a todos los proyectos.
      safeLog('OK', { userId, projectCount: ids.length, pcs: pcs.length, ms: Date.now() - startedAt });
      return { data: map };
    } catch (err: any) {
      safeLog('ERROR', { message: err?.message, stack: err?.stack, projectIds });
      // Evitamos propagar 500 crudo devolviendo data vacía (el filtro global ya loguea el error)
      return { data: {}, error: 'failed-connections' } as any;
    }
  }

  @Delete('connections')
  async disconnect(
    @CurrentUser() user: any,
    @Query('projectId') projectId: string,
    @Query('platform') platform: string,
  ) {
    const userId = user.sub || user._id;
    const ok = await this.projectModel.exists({ _id: projectId, createdBy: userId });
    if (!ok) return { data: { ok: false } };
    await this.pcModel.updateOne(
      { projectId, platform },
      { $set: { disabled: true } },
      { upsert: true },
    );
    return { data: { ok: true } };
  }

  @Post('connections')
  async enable(
    @CurrentUser() user: any,
    @Query('projectId') projectId: string,
    @Query('platform') platform: string,
  ) {
    const userId = user.sub || user._id;
    const ok = await this.projectModel.exists({ _id: projectId, createdBy: userId });
    if (!ok) return { data: { ok: false, reason: 'invalid-project' } };
    const fullUser = await this.userModel.findById(userId).select({ providers: 1 }).lean();
    const hasGoogle = !!(fullUser as any)?.providers?.google?.oauth?.accessToken;
    const hasFigma = !!(fullUser as any)?.providers?.figma?.oauth?.accessToken;
    const required = platform === 'GA4' ? hasGoogle : platform === 'FIGMA' ? hasFigma : false;
    if (!required) return { data: { ok: false, reason: 'no-user-provider' } };
    await this.pcModel.updateOne(
      { projectId, platform },
      { $set: { disabled: false } },
      { upsert: true },
    );
    return { data: { ok: true } };
  }

  @Get('ga4/oauth/start')
  async ga4Start(@CurrentUser() user: any, @Query('projectId') projectId: string, @Res() res: Response) {
    // projectId is optional now; validate only if provided
    if (projectId) {
      const ok = await this.projectModel.exists({ _id: projectId, createdBy: user.sub || user._id });
      if (!ok) return res.status(400).send('Invalid project');
    }
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || '',
      response_type: 'code',
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/tagmanager.readonly',
      ].join(' '),
      access_type: 'offline',
      include_granted_scopes: 'true',
      state: JSON.stringify({ t: 'ga4', projectId, uid: user.sub || user._id }),
    });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return res.redirect(url);
  }

  @Get('ga4/oauth/url')
  async ga4Url(@CurrentUser() user: any, @Query('projectId') projectId?: string) {
    if (projectId) {
      const ok = await this.projectModel.exists({ _id: projectId, createdBy: user.sub || user._id });
      if (!ok) return { data: { url: null } };
    }
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI || '',
      response_type: 'code',
      scope: [
        'openid',
        'email',
        'profile',
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/tagmanager.readonly',
      ].join(' '),
      access_type: 'offline',
      include_granted_scopes: 'true',
      state: JSON.stringify({ t: 'ga4', projectId, uid: user.sub || user._id }),
    });
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return { data: { url } };
  }

  @Get('figma/oauth/start')
  async figmaStart(@CurrentUser() user: any, @Query('projectId') projectId: string, @Res() res: Response) {
    // projectId is optional now; validate only if provided
    if (projectId) {
      const ok = await this.projectModel.exists({ _id: projectId, createdBy: user.sub || user._id });
      if (!ok) return res.status(400).send('Invalid project');
    }
    const params = new URLSearchParams({
      client_id: process.env.FIGMA_CLIENT_ID || '',
      redirect_uri: process.env.FIGMA_REDIRECT_URI || '',
      response_type: 'code',
      scope: (process.env.FIGMA_SCOPES || 'file_read').split(/[ ,]+/).filter(Boolean).join(' '),
      state: JSON.stringify({ t: 'figma', projectId, uid: user.sub || user._id }),
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log('[FIGMA OAUTH START] scopes=', params.get('scope'), 'uid=', user?.sub || user?._id, 'projectId=', projectId);
    }
    const url = `https://www.figma.com/oauth?${params.toString()}`;
    return res.redirect(url);
  }

  @Get('figma/token-status')
  async figmaTokenStatus(@CurrentUser() user: any) {
    try {
      console.log('[FIGMA TOKEN STATUS] Checking token status for user:', user.sub || user._id);
      
      const userDoc = await this.userModel.findById(user.sub || user._id).lean();
      const figmaToken = userDoc?.providers?.figma?.oauth?.accessToken;
      const expiresAt = userDoc?.providers?.figma?.oauth?.expiresAt;
      const figmaId = userDoc?.providers?.figma?.id;
      
      if (!figmaToken) {
        return { 
          data: {
            connected: false,
            valid: false,
            message: 'No hay token de Figma. Necesitas conectar tu cuenta.',
            details: {
              hasToken: false,
              hasExpiration: false,
              expired: false
            }
          }
        };
      }

      // Verificar si el token ha expirado
      let isExpired = false;
      let expiresInSeconds = null;
      if (expiresAt) {
        const expirationDate = new Date(expiresAt);
        const now = new Date();
        isExpired = now >= expirationDate;
        expiresInSeconds = Math.floor((expirationDate.getTime() - now.getTime()) / 1000);
      }

      // Probar el token con la API
      console.log('[FIGMA TOKEN STATUS] Testing token with API...');
      const response = await fetch('https://api.figma.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${figmaToken}`,
          'User-Agent': 'Analytics-Weaver/1.0',
        },
      });

      const isValid = response.ok;
      let userInfo = null;
      
      if (isValid) {
        userInfo = await response.json();
        console.log('[FIGMA TOKEN STATUS] Token valid, user:', userInfo.email || userInfo.handle);
      } else {
        console.error('[FIGMA TOKEN STATUS] Token invalid, status:', response.status);
      }

      return {
        data: {
          connected: true,
          valid: isValid,
          message: isValid 
            ? 'Token de Figma válido y funcionando correctamente.'
            : isExpired
              ? 'Token de Figma expirado. Necesitas reconectar tu cuenta.'
              : 'Token de Figma inválido. Necesitas reconectar tu cuenta.',
          details: {
            hasToken: true,
            hasExpiration: !!expiresAt,
            expired: isExpired,
            expiresAt: expiresAt,
            expiresInSeconds: expiresInSeconds,
            apiStatus: response.status,
            figmaUser: isValid ? {
              id: userInfo?.id,
              email: userInfo?.email,
              handle: userInfo?.handle
            } : null,
            storedFigmaId: figmaId
          }
        }
      };
    } catch (error: any) {
      console.error('[FIGMA TOKEN STATUS] Error checking token:', error);
      return {
        data: {
          connected: false,
          valid: false,
          message: 'Error verificando el token de Figma.',
          details: {
            error: error.message
          }
        }
      };
    }
  }

  @Get('figma/test-token')
  async testFigmaToken(@CurrentUser() user: any) {
    try {
      console.log('[TOKEN TEST] Testing Figma token for user:', user.sub || user._id);
      
      const userDoc = await this.userModel.findById(user.sub || user._id).lean();
      const figmaToken = userDoc?.providers?.figma?.oauth?.accessToken;
      
      console.log('[TOKEN TEST] Token exists:', !!figmaToken);
      console.log('[TOKEN TEST] Token length:', figmaToken?.length || 0);
      
      if (!figmaToken) {
        return { 
          error: true, 
          message: 'No hay token de Figma. Necesitas conectar tu cuenta.',
          data: { hasToken: false }
        };
      }

      // Probar el token
      console.log('[TOKEN TEST] Testing token with Figma API...');
      const response = await fetch('https://api.figma.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${figmaToken}`,
          'User-Agent': 'Analytics-Weaver/1.0',
        },
      });

      console.log('[TOKEN TEST] Figma API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('[TOKEN TEST] Figma API error:', errorText);
        
        return {
          error: true,
          message: `Token inválido (${response.status}). Necesitas reconectar Figma.`,
          data: { 
            hasToken: true, 
            tokenValid: false, 
            status: response.status,
            errorDetails: errorText 
          }
        };
      }

      const userData = await response.json();
      console.log('[TOKEN TEST] User data received:', userData.email, userData.handle);
      
      return {
        error: false,
        message: 'Token válido y funcionando.',
        data: {
          hasToken: true,
          tokenValid: true,
          userInfo: {
            email: userData.email,
            handle: userData.handle,
            teams: userData.teams?.length || 0
          }
        }
      };
    } catch (error: any) {
      console.error('[TOKEN TEST] Error:', error);
      return {
        error: true,
        message: 'Error verificando token.',
        data: { error: error.message }
      };
    }
  }

  @Get('figma/debug/token-info')
  async debugFigmaToken(@CurrentUser() user: any) {
    try {
      const userDoc = await this.userModel.findById(user.sub || user._id).lean();
      const figmaToken = userDoc?.providers?.figma?.oauth?.accessToken;
      
      if (!figmaToken) {
        return {
          data: {
            hasToken: false,
            message: 'No hay token de Figma configurado. Necesitas conectar tu cuenta.'
          }
        };
      }

      // Probar el token con la API de Figma
      const response = await fetch('https://api.figma.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${figmaToken}`,
          'User-Agent': 'Analytics-Weaver/1.0',
        },
      });

      if (!response.ok) {
        return {
          data: {
            hasToken: true,
            tokenValid: false,
            status: response.status,
            message: `Token inválido o expirado (${response.status}). Reconecta tu cuenta de Figma.`
          }
        };
      }

      const userData = await response.json();
      
      return {
        data: {
          hasToken: true,
          tokenValid: true,
          userInfo: {
            id: userData.id,
            email: userData.email,
            handle: userData.handle,
            teams: userData.teams?.length || 0
          },
          message: 'Token válido y funcionando correctamente.'
        }
      };
    } catch (error: any) {
      console.error('[FIGMA DEBUG] Error checking token:', error);
      return {
        data: {
          hasToken: false,
          tokenValid: false,
          error: error.message,
          message: 'Error verificando el token de Figma.'
        }
      };
    }
  }

  @Get('figma/test-file/:fileKey')
  async testSpecificFile(@CurrentUser() user: any, @Param('fileKey') fileKey: string) {
    try {
      console.log('[FILE TEST] Testing file access:', fileKey);
      
      const userDoc = await this.userModel.findById(user.sub || user._id).lean();
      const figmaToken = userDoc?.providers?.figma?.oauth?.accessToken;
      
      if (!figmaToken) {
        return { error: true, message: 'No hay token de Figma' };
      }

      // Probar acceso al archivo específico
      console.log('[FILE TEST] Testing file access with token...');
      const response = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
        headers: {
          'Authorization': `Bearer ${figmaToken}`,
          'User-Agent': 'Analytics-Weaver/1.0',
        },
      });

      console.log('[FILE TEST] File API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('[FILE TEST] File API error:', errorText);
        
        let message = '';
        switch (response.status) {
          case 403:
            message = 'Sin permisos para este archivo. Debe ser público o tienes que tener acceso.';
            break;
          case 404:
            message = 'Archivo no encontrado. Verifica que el ID sea correcto.';
            break;
          case 401:
            message = 'Token inválido o expirado.';
            break;
          default:
            message = `Error ${response.status}: ${errorText}`;
        }
        
        return {
          error: true,
          message,
          data: { 
            status: response.status,
            fileKey,
            errorDetails: errorText 
          }
        };
      }

      const fileData = await response.json();
      console.log('[FILE TEST] File name:', fileData.name);
      
      return {
        error: false,
        message: 'Acceso al archivo confirmado.',
        data: {
          fileKey,
          fileName: fileData.name,
          lastModified: fileData.lastModified,
          version: fileData.version
        }
      };
    } catch (error: any) {
      console.error('[FILE TEST] Error:', error);
      return {
        error: true,
        message: 'Error probando archivo.',
        data: { error: error.message }
      };
    }
  }

  @Post('figma/verify-file-access')
  async verifyFigmaFileAccess(
    @CurrentUser() user: any,
    @Body() body: { fileKey: string }
  ) {
    try {
      console.log('[INTEGRATIONS] Verifying access to Figma file:', body.fileKey);
      
      const result = await this.figma.getFileFrames(user.sub || user._id, body.fileKey);
      
      return {
        data: {
          hasAccess: true,
          framesCount: result?.frames?.length || 0,
          message: result?.frames?.length > 0 
            ? `Acceso confirmado. Se encontraron ${result.frames.length} pantallas.`
            : 'Acceso confirmado, pero no se encontraron pantallas en el archivo.'
        }
      };
    } catch (error: any) {
      console.error('[INTEGRATIONS] File access verification failed:', error);
      
      let errorMessage = 'Error verificando acceso al archivo.';
      let requiresReconnection = false;
      
      // Detectar si el error es de token expirado o inválido
      if (error?.message?.includes('Token') || 
          error?.message?.includes('expirado') || 
          error?.message?.includes('inválido') ||
          error?.message?.includes('401')) {
        errorMessage = error.message || 'Tu sesión de Figma ha expirado. Reconecta tu cuenta.';
        requiresReconnection = true;
      } 
      // Detectar si es un error de permisos
      else if (error?.message?.includes('Sin permisos') || error?.message?.includes('403')) {
        errorMessage = error.message || 'No tienes permisos para acceder a este archivo. Asegúrate de que sea público o tengas acceso.';
      } 
      // Detectar si el archivo no existe
      else if (error?.message?.includes('no encontrado') || error?.message?.includes('404')) {
        errorMessage = error.message || 'Archivo no encontrado. Verifica que la URL sea correcta.';
      }
      // Cualquier otro error
      else if (error?.message) {
        errorMessage = error.message;
      }
      
      return {
        data: {
          hasAccess: false,
          framesCount: 0,
          message: errorMessage,
          requiresReconnection
        }
      };
    }
  }

  @Post('figma/project/:projectId/file')
  async assignFigmaFile(
    @CurrentUser() user: any, 
    @Param('projectId') projectId: string,
    @Body() body: { fileKey: string; fileName: string; fileUrl?: string; thumbnail?: string }
  ) {
    try {
      console.log('[INTEGRATIONS] Assigning Figma file:', { 
        projectId, 
        fileKey: body.fileKey, 
        fileName: body.fileName,
        userId: user.sub || user._id 
      });

      // Verificar que el proyecto pertenece al usuario
      const project = await this.projectModel.findOne({ 
        _id: projectId, 
        createdBy: user.sub || user._id 
      });
      
      if (!project) {
        console.error('[INTEGRATIONS] Project not found:', projectId);
        return { error: true, message: 'Proyecto no encontrado' };
      }

      // Crear o actualizar la asociación
      const association = await this.projectFigmaFileModel.findOneAndUpdate(
        { projectId },
        {
          projectId,
          userId: user.sub || user._id,
          figmaFileKey: body.fileKey,
          figmaFileName: body.fileName,
          figmaFileUrl: body.fileUrl,
          figmaThumbnail: body.thumbnail,
          lastSynced: new Date(),
          isActive: true,
        },
        { upsert: true, new: true }
      );

      console.log('[INTEGRATIONS] File association created/updated:', association._id);

      // Garantizar que la conexion FIGMA quede activa para el proyecto
      await this.pcModel.updateOne(
        { projectId, platform: 'FIGMA' },
        { $set: { disabled: false } },
        { upsert: true },
      );

      console.log('[INTEGRATIONS] FIGMA connection enabled for project');

      // Verificar que podemos obtener frames inmediatamente
      try {
        console.log('[INTEGRATIONS] Testing frame access...');
        const testFrames = await this.figma.getFileFrames(user.sub || user._id, body.fileKey);
        console.log('[INTEGRATIONS] Test frames result:', testFrames?.frames?.length || 0, 'frames');
        
        if (testFrames?.frames?.length === 0) {
          console.warn('[INTEGRATIONS] No frames found in file - may be empty or permission issue');
        }
      } catch (testError) {
        console.error('[INTEGRATIONS] Error testing frame access:', testError);
        
        // Si es un error de permisos, devolver error inmediatamente
        if (testError && typeof testError === 'object' && 'message' in testError) {
          const errorMessage = (testError as any).message;
          if (errorMessage.includes('Sin permisos') || errorMessage.includes('403')) {
            // Remover la asociación que acabamos de crear
            await this.projectFigmaFileModel.findOneAndDelete({ projectId });
            return { 
              error: true, 
              message: 'No tienes permisos para acceder a este archivo de Figma. Asegúrate de que el archivo sea público o tengas acceso de editor/visualizador.'
            };
          } else if (errorMessage.includes('no encontrado') || errorMessage.includes('404')) {
            await this.projectFigmaFileModel.findOneAndDelete({ projectId });
            return { 
              error: true, 
              message: 'Archivo de Figma no encontrado. Verifica que la URL sea correcta.'
            };
          } else if (errorMessage.includes('Token') || errorMessage.includes('401')) {
            await this.projectFigmaFileModel.findOneAndDelete({ projectId });
            return { 
              error: true, 
              message: 'Tu sesión de Figma ha expirado. Reconecta tu cuenta de Figma.'
            };
          }
        }
        
        // Para otros errores, mostrar advertencia pero permitir la asociación
        console.warn('[INTEGRATIONS] Frame access test failed, but allowing association');
      }

      return { data: association };
    } catch (error: any) {
      console.error('[INTEGRATIONS] Error assigning Figma file:', error);
      return { 
        error: true, 
        message: error.message || 'Error al asociar archivo de Figma' 
      };
    }
  }

  @Get('figma/project/:projectId/file')
  async getProjectFigmaFile(
    @CurrentUser() user: any, 
    @Param('projectId') projectId: string
  ) {
    try {
      // Validar que el proyecto pertenece al usuario actual
      const project = await this.projectModel.findOne({ 
        _id: projectId, 
        createdBy: user.sub || user._id 
      });
      if (!project) {
        return { error: true, message: 'Proyecto no encontrado', data: null };
      }

      // Buscar asociación por proyecto (independiente del userId)
      const association = await this.projectFigmaFileModel.findOne({
        projectId,
        isActive: true,
      });

      return { data: association };
    } catch (error: any) {
      return { 
        error: true, 
        message: error.message || 'Error al obtener archivo de Figma del proyecto' 
      };
    }
  }

  @Delete('figma/project/:projectId/file')
  async removeFigmaFile(
    @CurrentUser() user: any, 
    @Param('projectId') projectId: string
  ) {
    try {
      // Validar que el proyecto pertenece al usuario actual
      const project = await this.projectModel.findOne({ 
        _id: projectId, 
        createdBy: user.sub || user._id 
      });
      if (!project) {
        return { error: true, message: 'Proyecto no encontrado' };
      }

      // Desactivar asociación por proyecto (independiente del userId)
      await this.projectFigmaFileModel.findOneAndUpdate(
        { projectId },
        { isActive: false }
      );

      return { data: { success: true } };
    } catch (error: any) {
      return { 
        error: true, 
        message: error.message || 'Error al remover archivo de Figma' 
      };
    }
  }

  @Get('figma/files')
  async figmaFiles(@CurrentUser() user: any) {
    try {
      const files = await this.figma.getUserFiles(user.sub || user._id);
      return { data: files };
    } catch (error: any) {
      return { 
        error: true, 
        message: error.message || 'Error al obtener archivos de Figma',
        data: { files: [] } 
      };
    }
  }

  @Get('figma/project/:projectId/files')
  async figmaProjectFiles(@CurrentUser() user: any, @Param('projectId') projectId: string) {
    try {
      // Verificar que el proyecto pertenece al usuario
      const project = await this.projectModel.findOne({ 
        _id: projectId, 
        createdBy: user.sub || user._id 
      });
      
      if (!project) {
        return { error: true, message: 'Proyecto no encontrado', data: [] };
      }

      // Verificar que el proyecto tiene conexión de Figma habilitada
      const connection = await this.pcModel.findOne({ 
        projectId, 
        platform: 'FIGMA',
        disabled: { $ne: true }
      });

      if (!connection) {
        return { error: true, message: 'Figma no está conectado para este proyecto', data: [] };
      }

      // Obtener archivos de Figma para el usuario (todos los archivos disponibles)
      const files = await this.figma.getUserFiles(user.sub || user._id);
      return { data: files };
    } catch (error: any) {
      return { 
        error: true, 
        message: error.message || 'Error al obtener archivos de Figma del proyecto',
        data: [] 
      };
    }
  }

  @Get('figma/files/:fileKey/frames')
  async figmaFrames(@CurrentUser() user: any, @Param('fileKey') fileKey: string) {
    try {
      const frames = await this.figma.getFileFrames(user.sub || user._id, fileKey);
      return { data: frames };
    } catch (error: any) {
      return { 
        error: true, 
        message: error.message || 'Error al obtener pantallas de Figma',
        data: { frames: [] },
      };
    }
  }

  @Post('wireframes/bulk-upload')
  async bulkUploadWireframes(
    @CurrentUser() user: any,
    @Body() body: { files?: Array<{ name?: string; data: string; mimeType?: string; width?: number; height?: number }> },
  ) {
    if (!body?.files || !Array.isArray(body.files) || body.files.length === 0) {
      return {
        error: true,
        message: 'Debes enviar al menos una imagen para importar.',
        data: { frames: [] },
      };
    }

    const importedFrames = body.files.map((file, idx) => {
      const normalized = this.normalizeImagePayload(file);
      return {
        id: ulid(),
        name: file.name || `Imagen ${idx + 1}`,
        displayName: file.name || `Imagen ${idx + 1}`,
        source: 'UPLOAD',
        uploaderId: user.sub || user._id,
        mimeType: normalized.mimeType,
        sizeBytes: normalized.buffer.length,
        width: file.width ?? null,
        height: file.height ?? null,
        dataUrl: normalized.dataUrl,
        createdAt: new Date().toISOString(),
      };
    });

    return {
      data: {
        total: importedFrames.length,
        frames: importedFrames,
      },
    };
  }

  private normalizeImagePayload(file: { data: string; mimeType?: string }) {
    if (!file?.data) {
      return {
        buffer: Buffer.from([]),
        mimeType: file?.mimeType || 'image/png',
        dataUrl: '',
      };
    }

    let base64Content = file.data;
    let detectedMime = file.mimeType || 'image/png';

    const dataUriMatch = file.data.match(/^data:(.+);base64,(.+)$/);
    if (dataUriMatch) {
      detectedMime = file.mimeType || dataUriMatch[1];
      base64Content = dataUriMatch[2];
    }

    const buffer = Buffer.from(base64Content, 'base64');
    const dataUrl = `data:${detectedMime};base64,${base64Content}`;

    return {
      buffer,
      mimeType: detectedMime,
      dataUrl,
    };
  }

  @Get('figma/oauth/url')
  async figmaUrl(@CurrentUser() user: any, @Query('projectId') projectId?: string) {
    if (projectId) {
      const ok = await this.projectModel.exists({ _id: projectId, createdBy: user.sub || user._id });
      if (!ok) return { data: { url: null } };
    }
    const params = new URLSearchParams({
      client_id: process.env.FIGMA_CLIENT_ID || '',
      redirect_uri: process.env.FIGMA_REDIRECT_URI || '',
      response_type: 'code',
      scope: (process.env.FIGMA_SCOPES || 'file_read').split(/[ ,]+/).filter(Boolean).join(' '),
      state: JSON.stringify({ t: 'figma', projectId, uid: user.sub || user._id }),
    });
    if (process.env.NODE_ENV !== 'production') {
      console.log('[FIGMA OAUTH URL] scopes=', params.get('scope'), 'uid=', user?.sub || user?._id, 'projectId=', projectId);
    }
    const url = `https://www.figma.com/oauth?${params.toString()}`;
    return { data: { url } };
  }

  // Proxy de imágenes de Figma (evita CORS en el navegador)
  @Get('figma/image-proxy')
  async figmaImageProxy(
    @CurrentUser() user: any,
    @Query('url') url: string,
    @Res() res: Response,
    @Req() req: any,
  ) {
    try {
      if (!url || !/^https?:\/\//i.test(url)) {
        return res.status(400).json({ error: true, message: 'URL inválida' });
      }
      const u = new URL(url);
      const host = u.hostname.toLowerCase();
      const allowed = (
        host.endsWith('figma.com') ||
        host.includes('figmausercontent.com') ||
        host.includes('s3') && host.includes('figma') ||
        host.endsWith('placehold.co')
      );
      if (!allowed) {
        return res.status(400).json({ error: true, message: 'Host no permitido' });
      }

      // Intentar sin auth primero
  let upstream = await fetch(url);
      // Si falla y es dominio de figma, reintentar con token
      if (!upstream.ok && host.includes('figma.com')) {
        // Intentar con token del usuario si está autenticado
        const uid = user?.sub || user?._id;
        if (uid) {
          const fullUser = await this.userModel.findById(uid).select({ providers: 1 }).lean();
          const token = (fullUser as any)?.providers?.figma?.oauth?.accessToken;
          if (token) {
            upstream = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          }
        }
      }

      if (!upstream.ok) {
        return res.status(upstream.status).json({ error: true, message: 'No se pudo obtener la imagen' });
      }

  // Encabezados (permitir credenciales hacia el origen del frontend)
      const ct = upstream.headers.get('content-type') || 'image/png';
  res.setHeader('Content-Type', ct);
  res.setHeader('Cache-Control', 'public, max-age=300');
  const origin = req.headers?.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

      const arrayBuffer = await upstream.arrayBuffer();
      return res.end(Buffer.from(arrayBuffer));
    } catch (err) {
      return res.status(500).json({ error: true, message: 'Proxy error' });
    }
  }

  // Export directo de imagen de un frame por projectId + nodeId
  @Get('figma/frame-image')
  async figmaFrameImage(
    @CurrentUser() user: any,
    @Query('projectId') projectId: string,
    @Query('nodeId') nodeId: string,
    @Query('scale') scaleStr: string,
    @Query('format') format: 'png' | 'jpg' | 'jpeg' = 'png',
    @Res() res: Response,
    @Req() req: any,
  ) {
    try {
      if (!projectId || !nodeId) return res.status(400).json({ error: true, message: 'Parámetros requeridos' });
      const userId = user.sub || user._id;
      const proj = await this.projectModel.findOne({ _id: projectId, createdBy: userId }).select({ _id: 1 }).lean();
      if (!proj) return res.status(403).json({ error: true, message: 'Proyecto inválido' });

      const assoc = await this.projectFigmaFileModel.findOne({ projectId, isActive: true }).select({ figmaFileKey: 1 }).lean();
      if (!assoc) return res.status(404).json({ error: true, message: 'Archivo Figma no asignado' });

      const fullUser = await this.userModel.findById(userId).select({ providers: 1 }).lean();
      const token = (fullUser as any)?.providers?.figma?.oauth?.accessToken;
      if (!token) return res.status(401).json({ error: true, message: 'Sin token de Figma' });

      const fileKey = (assoc as any).figmaFileKey;
      const scale = Math.min(4, Math.max(0.5, parseFloat(scaleStr || '2')));
      const fmt = (format || 'png').toLowerCase();
      const fmtParam = fmt === 'jpg' ? 'jpg' : fmt === 'jpeg' ? 'jpg' : 'png';

      const imagesUrl = new URL(`https://api.figma.com/v1/images/${fileKey}`);
      imagesUrl.searchParams.set('ids', nodeId);
      imagesUrl.searchParams.set('format', fmtParam);
      imagesUrl.searchParams.set('scale', String(scale));

      const upstream = await fetch(imagesUrl.toString(), {
        headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'Analytics-Weaver/1.0' },
      });
      if (!upstream.ok) {
        return res.status(upstream.status).json({ error: true, message: 'Figma images API error' });
      }
      const json = await upstream.json();
      const imageUrl = json?.images?.[nodeId];
      if (!imageUrl) return res.status(404).json({ error: true, message: 'Imagen no disponible' });

      // Descargar la imagen resultante (S3) y retransmitirla
      const imgResp = await fetch(imageUrl);
      if (!imgResp.ok) return res.status(502).json({ error: true, message: 'No se pudo descargar imagen' });
      const ct = imgResp.headers.get('content-type') || (fmtParam === 'png' ? 'image/png' : 'image/jpeg');
      res.setHeader('Content-Type', ct);
      res.setHeader('Cache-Control', 'public, max-age=300');
      const origin = req.headers?.origin || '*';
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      const buf = Buffer.from(await imgResp.arrayBuffer());
      return res.end(buf);
    } catch (err) {
      return res.status(500).json({ error: true, message: 'frame-image error' });
    }
  }

  @Get('ga4/event-counts')
  async ga4EventCounts(@CurrentUser() user: any, @Query('projectId') projectId: string, @Query('days') daysStr?: string) {
    const userId = user.sub || user._id;
    const ok = await this.projectModel.exists({ _id: projectId, createdBy: userId });
    if (!ok) return { data: {} };
    const events = await this.eventModel.find({ projectId, createdBy: userId }).select({ _id: 1, name: 1 }).lean();
    const names = events.map((e: any) => e.name);

    // Extraer accessToken de Google del usuario y propertyId (config o por proyecto)
    const fullUser = await this.userModel.findById(userId).select({ providers: 1 }).lean();
    const accessToken = (fullUser as any)?.providers?.google?.oauth?.accessToken || null;
    // Obtener GA4 Property ID guardado por proyecto (no usar fallback por env)
    const proj = await this.projectModel.findById(projectId).select({ ga4PropertyId: 1 }).lean();
    const propertyId = (proj as any)?.ga4PropertyId || null;

    let days = 7;
    if (daysStr) {
      const n = parseInt(daysStr, 10);
      if (!isNaN(n)) days = Math.max(1, Math.min(365, n));
    }
    const resp = await this.ga4.verifyEvents(accessToken, propertyId, names, days);
    const map: Record<string, number> = {};
    for (const ev of events) {
      const item = (resp as any)?.results?.find((r: any) => r.name === ev.name);
      map[String(ev._id)] = item ? Number(item.eventCount || 0) : 0;
    }
    return { data: map };
  }

  // Getter y setter de GA4 Property ID por proyecto
  @Get('ga4/property')
  async getGa4Property(
    @CurrentUser() user: any,
    @Query('projectId') projectId: string,
  ) {
    const userId = user.sub || user._id;
    const proj = await this.projectModel.findOne({ _id: projectId, createdBy: userId }).select({ ga4PropertyId: 1 }).lean();
    if (!proj) return { data: { ga4PropertyId: null } };
    return { data: { ga4PropertyId: (proj as any).ga4PropertyId || null } };
  }

  @Post('ga4/property')
  async setGa4Property(
    @CurrentUser() user: any,
    @Body() body: { projectId: string; ga4PropertyId: string },
  ) {
    const userId = user.sub || user._id;
    const { projectId, ga4PropertyId } = body || ({} as any);
    const ok = await this.projectModel.exists({ _id: projectId, createdBy: userId });
    if (!ok) return { data: { ok: false } };
    let val = (ga4PropertyId || '').trim();
    if (!val) {
      await this.projectModel.updateOne(
        { _id: projectId, createdBy: userId },
        { $unset: { ga4PropertyId: 1 } },
      );
      return { data: { ok: true } };
    }
    // Aceptar 'properties/123' o solo dígitos; extraer números y validar
    if (val.startsWith('properties/')) val = val.replace(/^properties\//, '');
    const digits = val.match(/\d{4,}/)?.[0] || '';
    if (!digits) return { data: { ok: false, reason: 'invalid-property-id' } };
    await this.projectModel.updateOne(
      { _id: projectId, createdBy: userId },
      { $set: { ga4PropertyId: `properties/${digits}` } },
    );
    return { data: { ok: true } };
  }

  @Get('validate-all')
  async validateAllIntegrations(@CurrentUser() user: any) {
    try {
      const userId = user.sub || user._id;
      const userDoc = await this.userModel.findById(userId).lean();
      
      const validationResults = {
        figma: await this.validateFigmaIntegration(userDoc),
        ga4: await this.validateGA4Integration(userDoc),
        // Podemos añadir más integraciones aquí
      };

      // Contar integraciones válidas e inválidas
      const totalIntegrations = Object.keys(validationResults).length;
      const validIntegrations = Object.values(validationResults).filter(result => result.isValid).length;
      const hasIssues = validIntegrations < totalIntegrations;

      return {
        success: true,
        data: {
          summary: {
            totalIntegrations,
            validIntegrations,
            hasIssues,
            message: hasIssues 
              ? `${totalIntegrations - validIntegrations} integración(es) requieren atención`
              : 'Todas las integraciones están funcionando correctamente'
          },
          integrations: validationResults
        }
      };
    } catch (error: any) {
      console.error('[VALIDATE INTEGRATIONS] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async validateFigmaIntegration(userDoc: any) {
    try {
      const figmaToken = userDoc?.providers?.figma?.oauth?.accessToken;
      
      if (!figmaToken) {
        return {
          platform: 'figma',
          isValid: false,
          hasToken: false,
          issue: 'not_connected',
          message: 'Figma no está conectado',
          action: 'connect',
          actionLabel: 'Conectar Figma'
        };
      }

      // Probar el token con la API de Figma
      const response = await fetch('https://api.figma.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${figmaToken}`,
          'User-Agent': 'Analytics-Weaver/1.0',
        },
      });

      if (!response.ok) {
        return {
          platform: 'figma',
          isValid: false,
          hasToken: true,
          issue: 'token_invalid',
          status: response.status,
          message: `Token de Figma inválido o expirado (${response.status})`,
          action: 'reconnect',
          actionLabel: 'Reconectar Figma'
        };
      }

      const userData = await response.json();
      return {
        platform: 'figma',
        isValid: true,
        hasToken: true,
        message: 'Figma conectado correctamente',
        userInfo: {
          email: userData.email,
          handle: userData.handle
        }
      };
    } catch (error: any) {
      return {
        platform: 'figma',
        isValid: false,
        hasToken: true,
        issue: 'connection_error',
        message: 'Error al verificar conexión con Figma',
        error: error.message,
        action: 'reconnect',
        actionLabel: 'Reconectar Figma'
      };
    }
  }

  private async validateGA4Integration(userDoc: any) {
    try {
      const ga4Token = userDoc?.providers?.ga4?.oauth?.accessToken;
      
      if (!ga4Token) {
        return {
          platform: 'ga4',
          isValid: false,
          hasToken: false,
          issue: 'not_connected',
          message: 'Google Analytics 4 no está conectado',
          action: 'connect',
          actionLabel: 'Conectar GA4'
        };
      }

      // Aquí podrías hacer una validación real del token de GA4 si es necesario
      // Por ahora, asumimos que si existe el token, es válido
      return {
        platform: 'ga4',
        isValid: true,
        hasToken: true,
        message: 'Google Analytics 4 conectado correctamente'
      };
    } catch (error: any) {
      return {
        platform: 'ga4',
        isValid: false,
        hasToken: true,
        issue: 'connection_error',
        message: 'Error al verificar conexión con GA4',
        error: error.message,
        action: 'reconnect',
        actionLabel: 'Reconectar GA4'
      };
    }
  }
}
