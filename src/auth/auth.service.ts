import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';

import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService) {}

  async validateUser(email: string, password: string) {
    // Handled by LocalStrategy, keep for completeness
    return null;
  }

  private signAccessToken(user: any) {
    const payload = { sub: String(user._id), email: user.email };
    return this.jwt.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_TTL || '15m',
    });
  }

  private signRefreshToken(user: any) {
    const payload = { sub: String(user._id), email: user.email };
    return this.jwt.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_TTL || '30d',
    });
  }

  setRefreshCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: false, // set true behind HTTPS
      sameSite: 'strict',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30d
    });
  }

  async login(user: any, res: Response) {
    const accessToken = this.signAccessToken(user);
    const refreshToken = this.signRefreshToken(user);
    this.setRefreshCookie(res, refreshToken);
    return { data: { accessToken } };
  }

  async register(email: string, password: string, displayName?: string) {
    const exists = await this.users.findByEmail(email);
    if (exists) throw new UnauthorizedException('Email ya registrado');
    return this.users.createLocalUser(email, password, displayName);
  }

  async refresh(user: any, res: Response) {
    const freshAccess = this.signAccessToken(user);
    const freshRefresh = this.signRefreshToken(user);
    this.setRefreshCookie(res, freshRefresh);
    return { data: { accessToken: freshAccess } };
  }

  async logout(res: Response) {
    res.clearCookie('refresh_token');
    return { data: { ok: true } };
  }
}
