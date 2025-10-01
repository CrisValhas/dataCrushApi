import {
  Body,
  Controller,
  Get,
  Delete,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { AuthGuard } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { RegisterDto } from './dtos/register.dto';
import { LoginDto } from './dtos/login.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CreateApiTokenDto } from './dtos/api-token.dto';
import { ApiTokenService } from './api-token.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PlatformConnection } from '../integrations/schemas/platform-connection.schema';
import { User } from '../users/schemas/user.schema';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private apiTokens: ApiTokenService,
    @InjectModel(PlatformConnection.name) private pcModel: Model<PlatformConnection>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.auth.register(dto.email, dto.password, dto.displayName);
    return { data: { _id: user._id, email: user.email } };
  }

  @UseGuards(AuthGuard('local'))
  @Post('login')
  async login(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.login((req as any).user, res);
  }

  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = (req as any).user;
    return this.auth.refresh(user, res);
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    return this.auth.logout(res);
  }

  @Post('api-tokens')
  async createApiToken(
    @Req() req: Request,
    @Body() dto: CreateApiTokenDto,
  ): Promise<{ data: { apiToken: string } }> {
    const user = (req as any).user;
    // In a real app, protect with access guard; keeping simple here.
    if (!user) throw new Error('Unauthorized');
    const token = await this.apiTokens.createToken(user.sub || user._id, dto.name, dto.scopes);
    return { data: { apiToken: token } };
  }

  @Delete('api-tokens/:id')
  async revokeApiToken(@Req() req: Request) {
    const user = (req as any).user;
    if (!user) throw new Error('Unauthorized');
    const tokenId = (req.params as any).id;
    await this.apiTokens.revokeToken(user.sub || user._id, tokenId);
    return { data: { ok: true } };
  }

  // OAuth callbacks for integrations (using GOOGLE_REDIRECT_URI / FIGMA_REDIRECT_URI)
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const code = (req.query as any).code as string;
      const state = JSON.parse(((req.query as any).state as string) || '{}');
      const projectId = state.projectId as string | undefined;
      const uid = state.uid as string | undefined;
      if (!code || !uid) return res.status(400).send('Missing code or state');

      const params = new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI || '',
        grant_type: 'authorization_code',
      });
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const tok = await r.json();
      // Fetch user info to store google id/email
      let googleId: string | undefined;
      let googleEmail: string | undefined;
      try {
        const ur = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tok.access_token}` },
        });
        const uinfo = await ur.json();
        googleId = uinfo.sub;
        googleEmail = uinfo.email;
      } catch {}

      await this.userModel.updateOne(
        { _id: uid },
        {
          $set: {
            'providers.google': {
              id: googleId || '',
              email: googleEmail,
              oauth: {
                accessToken: tok.access_token,
                refreshToken: tok.refresh_token,
                expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000).toISOString() : undefined,
              },
            },
          },
        },
        { upsert: false },
      );
      if (projectId) {
        await this.pcModel.updateOne(
          { projectId, platform: 'GA4' },
          { $set: { disabled: false } },
          { upsert: true },
        );
      }
  return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/integrations?connected=GA4`);
    } catch (e) {
  return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/integrations?error=ga4`);
    }
  }

  @Get('figma/callback')
  async figmaCallback(@Req() req: Request, @Res() res: Response) {
    try {
      const code = (req.query as any).code as string;
      const state = JSON.parse(((req.query as any).state as string) || '{}');
      const projectId = state.projectId as string | undefined;
      const uid = state.uid as string | undefined;
      
      if (!code || !uid) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('[FIGMA CALLBACK] Missing code or state', { codePresent: !!code, uid });
        }
        return res.status(400).send('Missing code or state');
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('[FIGMA CALLBACK] start', { uid, projectId, codeSnippet: code.slice(0, 6) });
      }
      
      const params = new URLSearchParams({
        client_id: process.env.FIGMA_CLIENT_ID || '',
        client_secret: process.env.FIGMA_CLIENT_SECRET || '',
        redirect_uri: process.env.FIGMA_REDIRECT_URI || '',
        code,
        grant_type: 'authorization_code',
      });
      
      // Log de debug con información sensible ofuscada
      if (process.env.NODE_ENV !== 'production') {
        const cid = process.env.FIGMA_CLIENT_ID || '';
        const csec = process.env.FIGMA_CLIENT_SECRET || '';
        const redir = process.env.FIGMA_REDIRECT_URI || '';
        console.log('[FIGMA CALLBACK] debug pre-token', {
          clientIdPrefix: cid.slice(0, 4),
          clientIdLen: cid.length,
          secretPrefix: csec.slice(0, 4),
          secretLen: csec.length,
          redirectExact: redir,
          codeLen: code.length,
          hasGrantType: params.get('grant_type') === 'authorization_code',
          scopesSent: (process.env.FIGMA_SCOPES || 'file_read'),
        });
      }
      
      let tok: any = null;
      let lastError: string = '';
      
      // Estrategia 1: POST estándar
      try {
        const response = await fetch('https://api.figma.com/v1/oauth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
            'User-Agent': 'Analytics-Weaver/1.0',
          },
          body: params.toString(),
        });
        
        const rawBody = await response.text();
        
        if (process.env.NODE_ENV !== 'production') {
          console.log('[FIGMA CALLBACK] POST response', {
            status: response.status,
            statusText: response.statusText,
            contentType: response.headers.get('content-type'),
            bodySnippet: rawBody.slice(0, 200),
          });
        }
        
        if (response.status === 200) {
          try {
            tok = JSON.parse(rawBody);
            if (tok?.access_token) {
              if (process.env.NODE_ENV !== 'production') {
                console.log('[FIGMA CALLBACK] POST success - token acquired');
              }
            }
          } catch (parseErr: any) {
            lastError = `POST parse error: ${parseErr.message}`;
          }
        } else {
          lastError = `POST failed: ${response.status} ${response.statusText} - ${rawBody.slice(0, 100)}`;
        }
      } catch (fetchErr: any) {
        lastError = `POST request error: ${fetchErr.message}`;
      }
      
      // Estrategia 2: GET con query params (solo si POST falló)
      if (!tok?.access_token) {
        try {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[FIGMA CALLBACK] trying GET fallback due to:', lastError);
          }
          
          const getResponse = await fetch(`https://api.figma.com/v1/oauth/token?${params.toString()}`, {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              'User-Agent': 'Analytics-Weaver/1.0',
            },
          });
          
          const getRawBody = await getResponse.text();
          
          if (process.env.NODE_ENV !== 'production') {
            console.log('[FIGMA CALLBACK] GET response', {
              status: getResponse.status,
              statusText: getResponse.statusText,
              bodySnippet: getRawBody.slice(0, 200),
            });
          }
          
          if (getResponse.status === 200) {
            try {
              tok = JSON.parse(getRawBody);
              if (tok?.access_token) {
                if (process.env.NODE_ENV !== 'production') {
                  console.log('[FIGMA CALLBACK] GET fallback success - token acquired');
                }
              }
            } catch (parseErr: any) {
              lastError += ` | GET parse error: ${parseErr.message}`;
            }
          } else {
            lastError += ` | GET failed: ${getResponse.status} ${getResponse.statusText}`;
          }
        } catch (getErr: any) {
          lastError += ` | GET request error: ${getErr.message}`;
        }
      }
      
      // Si no se pudo obtener el token, logear el error y redirigir
      if (!tok?.access_token) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[FIGMA CALLBACK] all token exchange strategies failed:', lastError);
        }
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/integrations?error=figma`);
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('[FIGMA CALLBACK] token response keys', Object.keys(tok));
      }
      
      // Obtener información del usuario de Figma
      let figmaId: string | undefined;
      try {
        const userResponse = await fetch('https://api.figma.com/v1/me', {
          headers: { 
            Authorization: `Bearer ${tok.access_token}`,
            'User-Agent': 'Analytics-Weaver/1.0',
          },
        });
        const userInfo = await userResponse.json();
        figmaId = userInfo?.id || userInfo?.user?.id;
        if (process.env.NODE_ENV !== 'production') {
          console.log('[FIGMA CALLBACK] fetched user', { figmaId, hasUserRoot: !!userInfo?.user });
        }
      } catch (userErr: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[FIGMA CALLBACK] failed to fetch user info:', userErr.message);
        }
      }

      // Guardar token en la base de datos
      const updatedUser = await this.userModel.findByIdAndUpdate(
        uid,
        {
          $set: {
            'providers.figma': {
              id: figmaId || '',
              oauth: {
                accessToken: tok.access_token,
                refreshToken: tok.refresh_token,
                expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000).toISOString() : undefined,
              },
            },
          },
        },
        { new: true, projection: { providers: 1 } },
      ).lean();
      
      if (process.env.NODE_ENV !== 'production') {
        if (!updatedUser) {
          console.log('[FIGMA CALLBACK] user not found for uid', uid);
        } else {
          console.log('[FIGMA CALLBACK] user updated providers.figma exists?', !!updatedUser.providers?.figma?.oauth?.accessToken);
        }
      }
      
      if (!updatedUser) {
        return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/integrations?error=figma`);
      }
      
      // Habilitar la conexión para el proyecto específico
      if (projectId) {
        await this.pcModel.updateOne(
          { projectId, platform: 'FIGMA' },
          { $set: { disabled: false } },
          { upsert: true },
        );
        if (process.env.NODE_ENV !== 'production') {
          console.log('[FIGMA CALLBACK] ensured platform connection record', { projectId });
        }
      }
      
      // Verificación final
      if (process.env.NODE_ENV !== 'production') {
        const reloaded = await this.userModel.findById(uid).select({ 'providers.figma': 1 }).lean();
        console.log('[FIGMA CALLBACK] user providers.figma after update', 
          reloaded?.providers?.figma ? Object.keys(reloaded.providers.figma) : null, 
          !!reloaded?.providers?.figma?.oauth?.accessToken
        );
      }
      
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/integrations?connected=FIGMA`);
    } catch (e) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[FIGMA CALLBACK] error', (e as any)?.message);
      }
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/app/integrations?error=figma`);
    }
  }
}
