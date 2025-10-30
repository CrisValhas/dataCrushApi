import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';

@ApiTags('debug')
@Controller('debug')
export class DebugController {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  @Get('figma/users-with-tokens')
  async listUsersWithFigmaTokens() {
    try {
      const users = await this.userModel
        .find({ 'providers.figma.oauth.accessToken': { $exists: true } })
        .select('email providers.figma.oauth.accessToken')
        .limit(10)
        .lean();

      const result = users.map(user => ({
        email: user.email,
        hasToken: !!user.providers?.figma?.oauth?.accessToken,
        tokenLength: user.providers?.figma?.oauth?.accessToken?.length || 0,
        tokenPreview: user.providers?.figma?.oauth?.accessToken?.substring(0, 10) + '...'
      }));

      return { 
        success: true, 
        usersWithTokens: result.length,
        users: result 
      };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  @Get('figma/test-token/:userEmail')
  async testFigmaTokenByEmail(@Param('userEmail') userEmail: string) {
    try {
      console.log('[DEBUG TOKEN TEST] Testing Figma token for user:', userEmail);
      
      const userDoc = await this.userModel.findOne({ email: userEmail }).lean();
      if (!userDoc) {
        return { 
          error: true, 
          message: 'Usuario no encontrado',
          data: { userExists: false }
        };
      }

      const figmaToken = userDoc?.providers?.figma?.oauth?.accessToken;
      
      console.log('[DEBUG TOKEN TEST] Token exists:', !!figmaToken);
      console.log('[DEBUG TOKEN TEST] Token length:', figmaToken?.length || 0);
      
      if (!figmaToken) {
        return { 
          error: true, 
          message: 'No hay token de Figma para este usuario.',
          data: { hasToken: false }
        };
      }

      // Probar el token
      console.log('[DEBUG TOKEN TEST] Testing token with Figma API...');
      const response = await fetch('https://api.figma.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${figmaToken}`,
          'User-Agent': 'Analytics-Weaver/1.0',
        },
      });

      console.log('[DEBUG TOKEN TEST] Figma API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('[DEBUG TOKEN TEST] Figma API error:', errorText);
        
        return {
          error: true,
          message: `Token inválido (${response.status}). Usuario necesita reconectar Figma.`,
          data: { 
            hasToken: true, 
            tokenValid: false, 
            status: response.status,
            errorDetails: errorText,
            tokenPreview: figmaToken.substring(0, 15) + '...'
          }
        };
      }

      const userData = await response.json();
      console.log('[DEBUG TOKEN TEST] User data received:', userData.email, userData.handle);
      
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
          },
          tokenPreview: figmaToken.substring(0, 15) + '...'
        }
      };
    } catch (error: any) {
      console.error('[DEBUG TOKEN TEST] Error:', error);
      return {
        error: true,
        message: 'Error verificando token.',
        data: { error: error.message }
      };
    }
  }

  @Get('validate-integrations/:userEmail')
  async validateIntegrationsByEmail(@Param('userEmail') userEmail: string) {
    try {
      const userDoc = await this.userModel.findOne({ email: userEmail }).lean();
      if (!userDoc) {
        return { 
          success: false, 
          error: 'Usuario no encontrado' 
        };
      }
      
      const validationResults = {
        figma: await this.validateFigmaIntegration(userDoc),
        ga4: await this.validateGA4Integration(userDoc),
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
      console.error('[DEBUG VALIDATE INTEGRATIONS] Error:', error);
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

  @Get('figma/test-file/:userEmail/:fileKey')
  async testFigmaFileAccessByEmail(
    @Param('userEmail') userEmail: string,
    @Param('fileKey') fileKey: string
  ) {
    try {
      console.log('[DEBUG FILE TEST] Testing Figma file access:', { userEmail, fileKey });
      
      const userDoc = await this.userModel.findOne({ email: userEmail }).lean();
      if (!userDoc) {
        return { 
          error: true, 
          message: 'Usuario no encontrado',
          data: { userExists: false }
        };
      }

      const figmaToken = userDoc?.providers?.figma?.oauth?.accessToken;
      
      if (!figmaToken) {
        return { 
          error: true, 
          message: 'No hay token de Figma para este usuario.',
          data: { hasToken: false }
        };
      }

      // Probar acceso al archivo específico
      console.log('[DEBUG FILE TEST] Testing file access with Figma API...');
      const response = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
        headers: {
          'Authorization': `Bearer ${figmaToken}`,
          'User-Agent': 'Analytics-Weaver/1.0',
        },
      });

      console.log('[DEBUG FILE TEST] Figma API response status:', response.status);
      
      // Obtener headers de respuesta para más información
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      console.log('[DEBUG FILE TEST] Response headers:', responseHeaders);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('[DEBUG FILE TEST] Figma API error:', errorText);
        
        // Intentar parsear el error como JSON para más detalles
        let errorDetails: any = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = errorJson;
          console.log('[DEBUG FILE TEST] Parsed error:', errorJson);
        } catch (e) {
          console.log('[DEBUG FILE TEST] Error not JSON format');
        }
        
        const errorMessage = typeof errorDetails === 'object' && errorDetails !== null
          ? errorDetails.err || errorDetails.message || errorText
          : errorDetails;
        
        return {
          error: true,
          message: `No se puede acceder al archivo (${response.status}). Error: ${errorMessage}`,
          data: { 
            fileKey,
            hasToken: true, 
            fileAccessible: false, 
            status: response.status,
            errorDetails: errorDetails,
            responseHeaders,
            tokenPreview: figmaToken.substring(0, 20) + '...',
            possibleCauses: [
              response.status === 403 ? 'Problema de scopes OAuth o permisos de API' : null,
              response.status === 404 ? 'Archivo no encontrado - verifica la URL' : null,
              response.status === 401 ? 'Token inválido o expirado' : null,
              'Verifica que tu aplicación OAuth tenga los scopes correctos'
            ].filter(Boolean)
          }
        };
      }

      const fileData = await response.json();
      console.log('[DEBUG FILE TEST] File data received:', fileData.name);
      
      return {
        error: false,
        message: 'Archivo accesible correctamente.',
        data: {
          fileKey,
          hasToken: true,
          fileAccessible: true,
          fileInfo: {
            name: fileData.name,
            lastModified: fileData.lastModified,
            thumbnailUrl: fileData.thumbnailUrl,
            version: fileData.version,
            role: fileData.role || 'unknown'
          }
        }
      };
    } catch (error: any) {
      console.error('[DEBUG FILE TEST] Error:', error);
      return {
        error: true,
        message: 'Error verificando acceso al archivo.',
        data: { error: error.message }
      };
    }
  }

  @Get('figma/token-details/:userEmail')
  async getFigmaTokenDetails(@Param('userEmail') userEmail: string) {
    try {
      const userDoc = await this.userModel.findOne({ email: userEmail }).lean();
      if (!userDoc) {
        return { error: true, message: 'Usuario no encontrado' };
      }

      const figmaToken = userDoc?.providers?.figma?.oauth?.accessToken;
      const refreshToken = userDoc?.providers?.figma?.oauth?.refreshToken;
      // const scopes = userDoc?.providers?.figma?.oauth?.scope; // No disponible en el esquema
      
      if (!figmaToken) {
        return { error: true, message: 'No hay token de Figma' };
      }

      // Información básica del usuario
      const userResponse = await fetch('https://api.figma.com/v1/me', {
        headers: {
          'Authorization': `Bearer ${figmaToken}`,
          'User-Agent': 'Analytics-Weaver/1.0',
        },
      });

      if (!userResponse.ok) {
        return {
          error: true,
          message: 'Token inválido',
          data: { status: userResponse.status }
        };
      }

      const userData = await userResponse.json();

      return {
        error: false,
        data: {
          tokenInfo: {
            hasToken: true,
            hasRefreshToken: !!refreshToken,
            tokenLength: figmaToken.length,
            tokenPreview: figmaToken.substring(0, 20) + '...',
            scopes: 'No scope information stored in token',
            refreshTokenPreview: refreshToken ? refreshToken.substring(0, 15) + '...' : 'None'
          },
          userInfo: {
            id: userData.id,
            email: userData.email,
            handle: userData.handle,
            teams: userData.teams?.map((team: any) => ({
              id: team.id,
              name: team.name,
              role: team.role
            })) || []
          },
          capabilities: {
            canAccessPersonalFiles: true, // Si el token funciona para /me, puede acceder a archivos personales
            teamsCount: userData.teams?.length || 0
          }
        }
      };
    } catch (error: any) {
      return {
        error: true,
        message: 'Error obteniendo detalles del token',
        data: { error: error.message }
      };
    }
  }
}